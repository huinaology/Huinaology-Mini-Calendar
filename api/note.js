// api/note.js
// Daily 페이지의 "Note" 속성을 읽고/저장한다.
const Config = require('../lib/config');
const { checkKey, getNotion } = require('../lib/common');

// rich_text 배열 맨 앞에서부터 type이 'text'가 아닌(수식/멘션 등) 세그먼트가
// 연속으로 나오는 구간을 "보존 구간"으로 떼어낸다. 위젯은 이 구간을 절대 건드리지 않고,
// 그 뒤에 이어지는 일반 텍스트만 불러오고/저장한다. (컬러박스 같은 서식이 텍스트로 뭉개지는 것 방지)
function splitPreserved(richText) {
    let i = 0;
    while (i < richText.length && richText[i].type !== 'text') i++;
    return { preserved: richText.slice(0, i), editable: richText.slice(i) };
}

function plainOf(segments) {
    return segments.map(s => s.plain_text || '').join('');
}

module.exports = async (req, res) => {
    if (!checkKey(req, res)) return;
    const notion = getNotion();
    const NOTE = Config.SCHEMA.NOTE;

    // 1. 메모 읽기 (GET)
    if (req.method === 'GET') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID required' });
        try {
            const page = await notion.pages.retrieve({ page_id: id });
            const richText = page.properties[NOTE]?.rich_text || [];
            const { preserved, editable } = splitPreserved(richText);

            let note = plainOf(editable);
            if (preserved.length > 0) note = note.replace(/^\n/, ''); // 서식 뒤 첫 줄바꿈은 표시상 제거

            return res.status(200).json({
                note,
                hasFormula: preserved.length > 0 // true면: 위젯에 안 보이는 서식(수식/컬러박스 등)이 앞에 있다는 뜻
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // 2. 메모 저장 (POST)
    if (req.method === 'POST') {
        const { id, note } = req.body || {};
        if (!id) return res.status(400).json({ error: 'ID required' });
        try {
            // 저장 직전에 현재 상태를 다시 조회해서 "보존 구간"(수식/서식)을 파악.
            // 이걸 그대로 앞에 유지한 채, 그 뒤 일반 텍스트만 새 값으로 교체한다.
            const page = await notion.pages.retrieve({ page_id: id });
            const richText = page.properties[NOTE]?.rich_text || [];
            const { preserved } = splitPreserved(richText);

            const bodyText = note || "";
            const newRichText = preserved.length > 0
                ? [...preserved, { text: { content: '\n' + bodyText } }]
                : (bodyText ? [{ text: { content: bodyText } }] : []);

            await notion.pages.update({ page_id: id, properties: { [NOTE]: { rich_text: newRichText } } });
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).end();
};
