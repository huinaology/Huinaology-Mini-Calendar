// lib/common.js
// API 공통: 접근 키 확인 + Notion 클라이언트 + 속성 읽기 도우미
const { Client } = require('@notionhq/client');
const Config = require('./config');

// 위젯 접근 비밀번호 확인. 실패 시 응답을 보내고 false 반환.
function checkKey(req, res) {
    const clientKey = req.headers['x-widget-key'] || req.query.key;
    if (!Config.ENV.WIDGET_SECRET || clientKey !== Config.ENV.WIDGET_SECRET) {
        res.status(401).json({ error: "접근 권한이 없습니다. (임베드 주소의 ?key= 값을 확인해주세요)" });
        return false;
    }
    if (!Config.ENV.NOTION_TOKEN) {
        res.status(500).json({ error: "NOTION_TOKEN 환경변수가 설정되지 않았습니다." });
        return false;
    }
    return true;
}

function getNotion() {
    return new Client({ auth: Config.ENV.NOTION_TOKEN, timeoutMs: 60000 });
}

// Notion API 는 초당 약 3회 요청 제한이 있어, 여러 DB를 한꺼번에 읽으면 일부 요청이 거절(429)될 수 있다.
// 요청 제한·일시 오류일 때만 잠시 기다렸다가 최대 4번까지 다시 시도한다.
const RETRYABLE = new Set(['rate_limited', 'service_unavailable', 'internal_server_error', 'conflict_error', 'notionhq_client_request_timeout']);
async function withRetry(fn, tries = 4) {
    for (let i = 0; ; i++) {
        try {
            return await fn();
        } catch (e) {
            const retryable = RETRYABLE.has(e.code) || e.status === 429 || e.status >= 500;
            if (!retryable || i >= tries - 1) throw e;
            const after = Number(e.headers?.get?.('retry-after')) || 0;
            await new Promise(r => setTimeout(r, after ? after * 1000 : 400 * Math.pow(2, i)));
        }
    }
}

// Formula / rich_text / rollup 어디에 있든 문자열 값을 뽑아낸다
function readPropText(prop) {
    if (!prop) return "";
    const f = prop.formula;
    if (f) {
        if (typeof f.string === 'string') return f.string;
        if (typeof f.number === 'number') return String(f.number);
        if (typeof f.boolean === 'boolean') return String(f.boolean);
        if (f.date && f.date.start) return f.date.start;
    }
    if (Array.isArray(prop.rich_text)) return prop.rich_text.map(t => t.plain_text).join('');
    if (Array.isArray(prop.title)) return prop.title.map(t => t.plain_text).join('');
    if (prop.select) return prop.select.name || "";
    if (prop.rollup && Array.isArray(prop.rollup.array)) {
        return prop.rollup.array.map(x => readPropText(x)).join('');
    }
    if (typeof prop.number === 'number') return String(prop.number);
    return "";
}

// Date / Formula / Rollup 어디에 있든 날짜 객체({start, end})를 찾아낸다
function extractDateFromProp(prop) {
    if (!prop) return null;
    if (prop.date) return prop.date;
    if (prop.formula?.date) return prop.formula.date;
    if (prop.rollup?.array?.[0]?.date) return prop.rollup.array[0].date;
    if (prop.rollup?.array?.[0]?.formula?.date) return prop.rollup.array[0].formula.date;
    return null;
}

function pageTitle(props) {
    let titleProp = props[Config.SCHEMA.TITLE];
    if (!titleProp || titleProp.type !== 'title') titleProp = Object.values(props).find(p => p && p.type === 'title');
    return (titleProp?.title || []).map(t => t.plain_text).join('') || "제목 없음";
}

module.exports = { checkKey, getNotion, withRetry, readPropText, extractDateFromProp, pageTitle };
