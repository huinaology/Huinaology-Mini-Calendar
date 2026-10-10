// api/create.js
// 탭에 따라 알맞은 마스터 DB에 새 페이지를 만든다.
//  - General / Work → Personal Master (Work 는 선택한 Contents 라벨을 연결)
//  - Media → Media Master
//  - Finance → Finance Master (수입/지출 + 금액)
// Daily 페이지는 Auto-Backup 위젯이 만들어주므로 여기서는 생성하지 않는다.
const Config = require('../lib/config');
const { checkKey, getNotion } = require('../lib/common');

const S = Config.SCHEMA;

module.exports = async (req, res) => {
    if (!checkKey(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const notion = getNotion();
    const { title, date, startDate, endDate, category, flow, amount, labelId } = req.body || {};
    const cleanTitle = String(title || '').trim();

    try {
        // === Finance Master: 결제 내역 (수입/지출) ===
        if (category === 'Finance') {
            const dbId = Config.ENV.FINANCE_MASTER_DB_ID;
            if (!dbId) return res.status(400).json({ error: "FINANCE_MASTER_DB_ID 환경변수가 없습니다." });
            const isIn = flow === 'in';
            const amt = Number(amount);
            if (!cleanTitle || !amt || amt <= 0) return res.status(400).json({ error: "제목과 금액을 확인해주세요." });

            const props = {
                [S.TITLE]: { title: [{ text: { content: cleanTitle } }] },
                [S.SCHEDULE]: { date: { start: date } },
                [S.FIN_FLOW]: { select: { name: isIn ? '수입' : '지출' } },
                [isIn ? S.FIN_INCOME : S.FIN_EXPENSE]: { number: amt }
            };
            const r = await notion.pages.create({ parent: { database_id: dbId }, icon: { emoji: "💰" }, properties: props });
            return res.status(200).json({ message: "Success", url: r.url });
        }

        if (!cleanTitle) return res.status(400).json({ error: "일정 제목을 입력해주세요." });

        const isMedia = category === 'Media';
        const dbId = isMedia ? Config.ENV.MEDIA_MASTER_DB_ID : Config.ENV.PERSONAL_MASTER_DB_ID;
        if (!dbId) {
            return res.status(400).json({ error: `${isMedia ? 'MEDIA' : 'PERSONAL'}_MASTER_DB_ID 환경변수가 없습니다.` });
        }

        const dateProperty = { start: startDate || date };
        if (endDate && endDate > dateProperty.start) dateProperty.end = endDate;

        const props = {
            [S.TITLE]: { title: [{ text: { content: cleanTitle } }] },
            [S.SCHEDULE]: { date: dateProperty }
        };
        // Work/Study 탭은 Career·Study 라벨, Media 탭은 Cultural 라벨을 연결해야 해당 탭에 보인다
        if ((category === 'Work' || category === 'Media') && labelId) props[S.CONTENTS] = { relation: [{ id: labelId }] };

        const icon = isMedia ? "🎬" : (category === 'Work' ? "💼" : "📅");
        const r = await notion.pages.create({ parent: { database_id: dbId }, icon: { emoji: icon }, properties: props });
        return res.status(200).json({ message: "Success", url: r.url });
    } catch (error) {
        console.error("Notion API Error:", error);
        // 노션이 보낸 정확한 에러 메시지를 화면으로 넘겨준다
        return res.status(500).json({ error: error.message || "페이지 생성에 실패했습니다." });
    }
};
