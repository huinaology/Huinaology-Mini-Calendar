// api/calendar.js
// 3개의 마스터 DB(Personal / Media / Finance)와 Daily DB에서 일정 데이터를 불러온다.
//  - Personal / Media Master: 연결된 Contents Label 의 Sort 로 탭을 나눈다
//      Career·Study → 'Work' / Cultural 포함 → 'Media' / 그 외 → 'General'
//  - Finance Master: 'Finance'
//  - Daily: 연도와 무관하게 오늘 기준 전후 2주만
const Config = require('../lib/config');
const { checkKey, getNotion, withRetry, readPropText, extractDateFromProp, pageTitle } = require('../lib/common');

const S = Config.SCHEMA;

function kstToday() {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + Config.TZ_OFFSET_HOURS * 3600000);
}
function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ------------------------------------------------------------
// 관계형 대상(Contents Label / Progress) 제목 캐시
// 같은 서버 인스턴스가 재사용되는 동안(최대 10분) 다시 조회하지 않는다
// ------------------------------------------------------------
const RELATION_TTL = 10 * 60 * 1000;
const relationCache = {};

// 속성 이름을 대소문자 무시로 찾는다 (예: Sort / sort)
function findPropKey(props, name) {
    const want = name.toLowerCase();
    return Object.keys(props || {}).find(k => k.toLowerCase() === want);
}

// 관계형 대상 DB 전체를 읽어 { 페이지ID: { title, sort } } 로 만든다.
// 같은 대상 DB(예: Personal·Media 가 함께 쓰는 Contents 라벨 DB)는 한 번만 읽도록 진행 중인 요청도 공유한다.
// 실패한 결과는 캐시하지 않는다(다음 요청에서 다시 시도).
function loadTargetMap(notion, targetId) {
    const hit = relationCache[targetId];
    if (hit && (hit.pending || Date.now() - hit.at < RELATION_TTL)) return hit.promise;

    const promise = (async () => {
        const map = {};
        let cursor = undefined, hasMore = true, guard = 0;
        while (hasMore && guard++ < 5) {
            const r = await withRetry(() => notion.databases.query({ database_id: targetId, start_cursor: cursor, page_size: 100 }));
            r.results.forEach(p => {
                const sortKey = findPropKey(p.properties, S.CONTENTS_SORT);
                map[p.id] = {
                    title: pageTitle(p.properties),
                    sort: sortKey ? readPropText(p.properties[sortKey]).trim() : ''
                };
            });
            hasMore = r.has_more; cursor = r.next_cursor;
        }
        return map;
    })();
    const entry = { pending: true, promise };
    relationCache[targetId] = entry;
    promise.then(() => { entry.pending = false; entry.at = Date.now(); })
           .catch(() => { if (relationCache[targetId] === entry) delete relationCache[targetId]; });
    return promise;
}

// dbId 의 관계형 속성(propName)이 가리키는 DB를 읽는다. 실패하면 errors 에 이유를 남기고 빈 객체를 돌려준다.
async function loadRelationMap(notion, dbId, propName, errors) {
    if (!dbId) return {};
    try {
        const db = await withRetry(() => notion.databases.retrieve({ database_id: dbId }));
        const relKey = findPropKey(db.properties, propName);
        const targetId = relKey ? db.properties[relKey]?.relation?.database_id : null;
        if (!targetId) {
            if (errors) errors.push(`${propName} 관계형 속성을 찾지 못함`);
            return {};
        }
        return await loadTargetMap(notion, targetId);
    } catch (e) {
        console.error(`⚠️ 관계형 대상 조회 실패 (${propName}):`, e.message);
        if (errors) errors.push(`${propName} DB를 읽지 못함: ${e.message}`);
        return {};
    }
}

// Contents Label 의 Sort(선택속성) 값 → 종류. 라벨 페이지 제목은 보지 않으므로 사용자가 라벨 이름을 바꿔도 그대로 동작한다.
const R = Config.SORT_RULES;
function sortKind(sort) {
    const s = String(sort || '').trim().toLowerCase();
    if (s === R.CAREER) return 'career';
    if (s === R.STUDY) return 'study';
    if (s.includes(R.CULTURAL)) return 'cultural';
    if (s === R.EVENT) return 'event';
    return 'plain';
}

// 위젯에서 숨길 라벨 제목 (예: Reminder)
const HIDDEN_LABELS = new Set((Config.HIDDEN_LABEL_TITLES || []).map(t => t.trim().toLowerCase()));

// 일정에 연결된 라벨들 → { category: 탭, kind: 아이콘 색 구분 }
//  우선순위: Career > Study > Cultural > Event > 그 외(Daily·Scrap·라벨 없음)
const KIND_ORDER = ['career', 'study', 'cultural', 'event'];
function classify(labelIds, contentsMap) {
    const kinds = new Set(labelIds.map(id => sortKind(contentsMap[id]?.sort)));
    const kind = KIND_ORDER.find(k => kinds.has(k)) || 'plain';
    const category = (kind === 'career' || kind === 'study') ? 'Work' : (kind === 'cultural' ? 'Media' : 'General');
    return { category, kind };
}

function progressText(props, progressMap) {
    const rel = props[S.PROGRESS]?.relation || [];
    if (rel.length && progressMap[rel[0].id]) return progressMap[rel[0].id].title;
    return readPropText(props[S.PROGRESS]);
}

// ------------------------------------------------------------
// DB 조회
// ------------------------------------------------------------
async function queryRange(notion, dbId, queryStart, queryEnd, maxRequests) {
    let all = [], hasMore = true, cursor = undefined, count = 0;
    while (hasMore && count < maxRequests) {
        try {
            const r = await withRetry(() => notion.databases.query({
                database_id: dbId,
                start_cursor: cursor,
                page_size: 100,
                filter: {
                    and: [
                        { property: S.SCHEDULE, date: { on_or_after: queryStart } },
                        { property: S.SCHEDULE, date: { on_or_before: queryEnd } }
                    ]
                },
                sorts: [{ property: S.SCHEDULE, direction: 'descending' }]
            }));
            all = all.concat(r.results);
            hasMore = r.has_more; cursor = r.next_cursor; count++;
        } catch (e) {
            console.error(`⚠️ 부분 로드 실패 (${dbId}):`, e.message);
            break;
        }
    }
    return all;
}

function baseItem(page, category) {
    const props = page.properties;
    // 우선순위: ⏲️ipr Calendar → Schedule
    const dateObj = extractDateFromProp(props[S.IPR_CALENDAR]) || extractDateFromProp(props[S.SCHEDULE]);
    if (!dateObj || !dateObj.start) return null;
    return {
        id: page.id,
        title: pageTitle(props),
        startDate: dateObj.start.substring(0, 10),
        endDate: dateObj.end ? dateObj.end.substring(0, 10) : dateObj.start.substring(0, 10),
        category,
        url: page.url
    };
}

// Personal / Media Master 공통: 연결된 Contents 라벨의 Sort 로 탭(category)과 아이콘 색(kind)을 정한다.
//  - Career·Study → Work/Study 탭 / Cultural 포함 → Media 탭 / 그 외 → 일반일정 탭
async function fetchMaster(notion, dbId, yStart, yEnd, maxRequests, errors) {
    if (!dbId) return { events: [], labels: [] };
    const [pages, contentsMap, progressMap] = await Promise.all([
        queryRange(notion, dbId, yStart, yEnd, maxRequests),
        loadRelationMap(notion, dbId, S.CONTENTS, errors),
        loadRelationMap(notion, dbId, S.PROGRESS, errors)
    ]);

    const events = pages.map(page => {
        const props = page.properties;
        const relKey = findPropKey(props, S.CONTENTS);
        const labelIds = ((relKey && props[relKey]?.relation) || []).map(r => r.id);
        if (labelIds.some(id => HIDDEN_LABELS.has(String(contentsMap[id]?.title || '').trim().toLowerCase()))) return null;
        const { category, kind } = classify(labelIds, contentsMap);
        const item = baseItem(page, category);
        if (!item) return null;
        item.kind = kind;
        item.progress = progressText(props, progressMap);
        item.label = labelIds.map(id => contentsMap[id]?.title).filter(Boolean)[0] || "";
        return item;
    }).filter(Boolean);

    // 새 일정을 만들 때 연결할 수 있는 라벨 목록 (Work/Study 탭: Career·Study, Media 탭: Cultural)
    const labels = Object.entries(contentsMap)
        .map(([id, v]) => ({ id, title: v.title, sort: v.sort, kind: sortKind(v.sort) }))
        .filter(l => l.kind === 'career' || l.kind === 'study' || l.kind === 'cultural');

    return { events, labels };
}

async function fetchFinance(notion, yStart, yEnd) {
    const dbId = Config.ENV.FINANCE_MASTER_DB_ID;
    if (!dbId) return [];
    // 결제 내역은 건수가 많아 페이지 상한을 넉넉히
    const pages = await queryRange(notion, dbId, yStart, yEnd, 12);
    return pages.map(page => {
        const props = page.properties;
        const item = baseItem(page, 'Finance');
        if (!item) return null;
        item.expense = props[S.FIN_EXPENSE]?.number ?? null;
        item.income = props[S.FIN_INCOME]?.number ?? null;
        item.flow = readPropText(props[S.FIN_FLOW]).trim();
        // "계 (통화반환)" Formula 텍스트 그대로 (통화기호·부호 포함). 공백 차이 대비해 부분일치로 키 탐색
        const totalKey = Object.keys(props).find(k => k.replace(/\s/g, '').includes('통화반환'));
        item.totalText = totalKey ? readPropText(props[totalKey]).trim() : "";
        return item;
    }).filter(Boolean);
}

async function fetchDaily(notion) {
    const dbId = Config.ENV.DAILY_DB_ID;
    if (!dbId) return [];
    const today = kstToday();
    const back = new Date(today); back.setDate(today.getDate() - Config.DAILY_WINDOW_DAYS);
    const fwd = new Date(today); fwd.setDate(today.getDate() + Config.DAILY_WINDOW_DAYS);
    const pages = await queryRange(notion, dbId, ymd(back), ymd(fwd), 2);
    return pages.map(page => baseItem(page, 'Daily')).filter(Boolean);
}

module.exports = async (req, res) => {
    if (!checkKey(req, res)) return;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    // 요청받은 연도(?year=YYYY)의 1월~12월만 로드. 없으면 올해.
    let year = parseInt(req.query.year, 10);
    if (!Number.isFinite(year) || year < 2010 || year > 2050) year = kstToday().getFullYear();
    const yStart = `${year}-01-01`;
    const yEnd = `${year}-12-31`;

    const notion = getNotion();
    const labelErrors = [];
    const [personal, media, finance, daily] = await Promise.allSettled([
        fetchMaster(notion, Config.ENV.PERSONAL_MASTER_DB_ID, yStart, yEnd, 6, labelErrors),
        fetchMaster(notion, Config.ENV.MEDIA_MASTER_DB_ID, yStart, yEnd, 4, labelErrors),
        fetchFinance(notion, yStart, yEnd),
        fetchDaily(notion)
    ]);
    const ok = r => (r.status === 'fulfilled' ? r.value : null);

    const events = [
        ...(ok(personal)?.events || []),
        ...(ok(media)?.events || []),
        ...(ok(finance) || []),
        ...(ok(daily) || [])
    ];

    // 새 일정에 연결할 라벨: Work/Study 탭은 Personal Master 쪽, Media 탭은 Media Master 쪽 라벨
    const workLabels = (ok(personal)?.labels || []).filter(l => l.kind === 'career' || l.kind === 'study');
    const mediaLabels = (ok(media)?.labels || []).filter(l => l.kind === 'cultural');

    // 설정 탭에서 보여줄 연결 상태
    const connected = {
        personal: !!Config.ENV.PERSONAL_MASTER_DB_ID,
        media: !!Config.ENV.MEDIA_MASTER_DB_ID,
        finance: !!Config.ENV.FINANCE_MASTER_DB_ID,
        daily: !!Config.ENV.DAILY_DB_ID
    };

    // 라벨 DB를 못 읽으면 모든 일정이 일반일정으로 보이므로, 설정 탭에 원인을 띄울 수 있게 함께 보낸다
    res.status(200).json({ year, events, labels: workLabels, mediaLabels, connected, labelErrors: [...new Set(labelErrors)] });
};
