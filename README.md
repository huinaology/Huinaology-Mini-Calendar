# 📅 Huinaology Calendar Widget

Huinaology 노션 템플릿용 **캘린더 위젯**입니다. 노션 페이지 안에서 Personal / Media / Finance Master DB와 Daily의 일정을 달력으로 보고, 간단한 일정 추가와 Daily 메모 입력을 할 수 있습니다.

프로그래밍 지식이 전혀 없어도, 아래 순서를 그대로 따라오시면 10분 안에 설치할 수 있습니다.

## 🚀 준비물
1. 노션 개발자 센터에서 노션 API 발급 (https://app.notion.com/developers/connections)
2. Github 계정 (https://github.com/) — 없으면 이메일로 무료 가입
3. Vercel 계정 (https://vercel.com/) — **Github 계정으로 바로 가입 가능**

## 🛠️ 설치 가이드 (No-Code)

### STEP 1. 노션 API 토큰 만들기
1. https://app.notion.com/developers/connections 접속 → **[새 API 통합]**
2. 이름(예: `Calendar Widget`)을 입력하고 템플릿이 있는 워크스페이스를 선택 → 저장
3. 표시되는 **내부 통합 시크릿**(`ntn_`으로 시작)을 복사해둡니다. 이게 `NOTION_TOKEN`입니다.

### STEP 2. 템플릿에 API 연결하기
1. Huinaology 템플릿의 **최상위 페이지** 우측 상단 **[···] → [연결] → STEP 1에서 만든 통합** 선택

    > ⚠️ 아래 표의 DB만 하나씩 연결하면 안 됩니다. 위젯은 일정에 연결된 **라벨 DB와 진행 상태 DB**도 함께 읽어서 탭 구분, 아이콘 색, 진행 상태를 표시합니다. 최상위 페이지에 연결하면 그 아래 DB가 모두 함께 연결됩니다.
    > DB를 하나씩 연결하셨다면 라벨 DB와 진행 상태 DB에도 같은 통합을 연결해주세요. 빠져 있으면 모든 일정이 일반일정으로만 보이고, 위젯 설정 탭에 안내 문구가 표시됩니다.

2. 아래 DB의 ID를 복사해둡니다. DB를 전체 페이지로 열었을 때 주소의 `notion.so/` 뒤, `?v=` 앞의 32자리가 DB ID입니다.

    | DB | 환경 변수 |
    |---|---|
    | Personal Master DB | `PERSONAL_MASTER_DB_ID` |
    | Media Master DB | `MEDIA_MASTER_DB_ID` |
    | Finance Master DB | `FINANCE_MASTER_DB_ID` |
    | Daily Archive | `DAILY_DB_ID` |

    > 사용하지 않는 DB는 비워두셔도 됩니다. (해당 탭만 비어 있게 표시됩니다)

### STEP 3. Vercel로 1초 배포하기
아래 버튼을 누르면 Vercel이 자동으로 **① 이 저장소를 여러분의 Github 계정으로 복사하고 → ② 필요한 값을 입력하는 화면을 띄운 뒤 → ③ 자동으로 배포**까지 해줍니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/huinaology/Huinaology-Mini-Calendar&env=WIDGET_SECRET,NOTION_TOKEN,PERSONAL_MASTER_DB_ID,MEDIA_MASTER_DB_ID,FINANCE_MASTER_DB_ID,DAILY_DB_ID)

1. **Github 로그인/연결** → 저장소 이름을 정하고 다음으로 넘어갑니다.
2. **환경 변수 입력 화면**에서 아래 값을 입력합니다.

    | 환경 변수 | 설명 |
    |---|---|
    | `WIDGET_SECRET` | 위젯 접근 비밀번호. 아무 문자열이나 직접 정해서 입력 (예: `mycal123`) |
    | `NOTION_TOKEN` | STEP 1의 내부 통합 시크릿 |
    | `PERSONAL_MASTER_DB_ID` | STEP 2의 Personal Master DB ID |
    | `MEDIA_MASTER_DB_ID` | STEP 2의 Media Master DB ID |
    | `FINANCE_MASTER_DB_ID` | STEP 2의 Finance Master DB ID |
    | `DAILY_DB_ID` | STEP 2의 Daily Archive DB ID |

3. **Deploy** 버튼을 누르면 1분 이내로 배포가 끝나고, 발급된 주소(`https://내프로젝트이름.vercel.app`)가 나옵니다.

### STEP 4. 노션에 임베드하기
발급받은 주소 뒤에 `?key=STEP 3에서 정한 WIDGET_SECRET값` 을 붙여서 노션 페이지에 **임베드(Embed) 블록**으로 붙여넣으면 끝입니다.

```
https://내프로젝트이름.vercel.app?key=mycal123
```

주소에 아래 값을 덧붙이면 해당 설정으로 고정해서 열 수 있습니다. (위젯의 설정 탭에서도 바꿀 수 있습니다)

```
https://내프로젝트이름.vercel.app?key=mycal123&view=horizontal&color=lavender
```

| 값 | 선택지 |
|---|---|
| `view` | `popup` (기본, 달력만) / `horizontal` (가로) / `vertical` (세로) |
| `filter` | 처음 열릴 탭: `all` / `Daily` / `General` / `Work` / `Media` / `Finance` |
| `border` | `plain` (기본) / `stamp` (우표) / `none` (테두리 없음) |
| `color` | `tab` (기본, 탭별 색상) / `lavender` / `rose` / `peach` / `lemon` / `mint` / `aqua` / `powder` / `sage` / `creme` / `slate` |
| `label` | `Work` (기본) / `School` |

## 🛠️ 업데이트 방법
위젯 설정 탭에서 새로운 버전 알림이 뜰 경우, 아래 순서대로 업데이트하실 수 있습니다.

1. 이 저장소(https://github.com/huinaology/Huinaology-Mini-Calendar)에서 변경된 파일을 열어 전체 코드를 복사합니다.
2. STEP 3에서 만들어진 내 Github 저장소로 이동해 동일한 파일을 열고, 우측 상단 연필 아이콘(Edit this file)으로 기존 코드를 지운 뒤 새 코드를 붙여넣습니다.
3. 페이지 하단 **[Commit changes...]** 로 저장합니다.
4. [Vercel 대시보드](https://vercel.com/dashboard)에서 해당 프로젝트의 **[Deployments] → [...] → [Redeploy]** 를 누르면 끝입니다.

## ❓문제가 생겼을 때
- **"인증 오류"** 알림: 임베드 주소의 `?key=` 값이 `WIDGET_SECRET`과 같은지 확인해주세요.
- **달력이 비어 있음**: STEP 2-1의 **[연결]** 을 했는지, DB ID가 올바른지 확인해주세요. 위젯 설정 탭의 **연결된 DB** 에서 입력된 DB를 확인할 수 있습니다.
- **모든 일정이 일반일정으로만 보이고 진행 상태 아이콘이 없음**: 라벨 DB나 진행 상태 DB에 통합이 연결되지 않은 경우입니다. STEP 2-1처럼 최상위 페이지에 연결하거나, 두 DB에도 같은 통합을 연결해주세요. 연결 후 위젯을 새로고침하면 바로 반영되고, 따로 Redeploy 할 필요는 없습니다.
- 환경 변수를 고친 뒤에는 Vercel에서 **[Redeploy]** 를 해야 반영됩니다.
