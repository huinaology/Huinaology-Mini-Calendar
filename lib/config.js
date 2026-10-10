// lib/config.js
// Huinaology Calendar (Public) 전용 설정.
// 개인용의 Book DB / Google 내보내기 등은 존재하지 않으므로 아예 정의하지 않는다.
const Config = {
    // 1. 환경 변수 (DB ID) 매핑 — Auto-Backup(Public)과 같은 이름을 사용
    ENV: {
        NOTION_TOKEN: process.env.NOTION_TOKEN,
        WIDGET_SECRET: process.env.WIDGET_SECRET,
        PERSONAL_MASTER_DB_ID: process.env.PERSONAL_MASTER_DB_ID,
        FINANCE_MASTER_DB_ID: process.env.FINANCE_MASTER_DB_ID,
        MEDIA_MASTER_DB_ID: process.env.MEDIA_MASTER_DB_ID,
        DAILY_DB_ID: process.env.DAILY_DB_ID,
    },

    // 2. 노션 속성(Property) 이름 (Public 템플릿 기준)
    SCHEMA: {
        TITLE: 'Title',
        SCHEDULE: 'Schedule',
        IPR_CALENDAR: '⏲️ipr Calendar',
        NOTE: 'Note',
        CONTENTS: 'Contents',          // Personal Master → Contents Label 관계형
        CONTENTS_SORT: 'Sort',         // Contents Label 의 구분(select)
        PROGRESS: 'Progress',          // 진행 상태 관계형
        FIN_FLOW: '수입/지출',          // Finance: select (수입 / 지출)
        FIN_INCOME: '수입 금액',
        FIN_EXPENSE: '지출 금액',
        FIN_TOTAL_TEXT: '계 (통화반환)'  // 통화기호·부호가 포함된 표시용 Formula
    },

    // 3. Contents Label 의 Sort(선택속성) 값으로 일정 종류를 나눈다. 라벨 페이지 제목은 보지 않는다.
    //    (대소문자 무시. Cultural 은 "Cultural Experience" 처럼 포함만 되어도 인식)
    SORT_RULES: {
        CAREER: 'career',     // Work/Study 탭 (파랑)
        STUDY: 'study',       // Work/Study 탭 (노랑, 자기계발)
        CULTURAL: 'cultural', // Media 탭 — 포함 여부로 판별
        EVENT: 'event'        // 일반일정 탭 (빨강, 공휴일·이벤트)
    },

    // 3-1. 이 제목의 라벨이 연결된 일정은 위젯 어디에도 표시하지 않는다 (대소문자 무시)
    //      Reminder 는 Sort 가 Daily 라 Sort 로는 구분할 수 없어 예외적으로 라벨 제목으로 판별한다.
    HIDDEN_LABEL_TITLES: ['Reminder'],

    // 4. Daily 탭은 연도와 무관하게 항상 "오늘 기준 전후 N일"만 불러온다
    DAILY_WINDOW_DAYS: 14,

    // 5. 한국 시간(KST) 기준
    TZ_OFFSET_HOURS: 9
};

module.exports = Config;
