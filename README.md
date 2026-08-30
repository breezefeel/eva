# 영어 게임 실시간 번역

핸드폰·아이패드 카메라로 영어 게임 화면을 비추면

- 왼쪽: 실시간 카메라
- 오른쪽 위: 영어 자막
- 그 아래: 한글 번역
- 그 아래: 단어 뜻
- 맨 아래: 문법·해석 방법

이 순서대로 실시간 갱신되는 웹앱입니다. 설치 없이 브라우저에서 동작하고, GitHub Pages에 올리면 링크로 바로 쓸 수 있습니다.

## 쓰는 방법

1. 페이지를 연 뒤 **카메라 시작**을 누르고 권한을 허용합니다.
2. 게임 화면을 비추면 카메라에 보이는 영어를 모두 읽습니다. 여러 문장은 한 줄씩 나눠 보여줍니다.
3. 카메라를 켜면 **1초마다** 화면을 봅니다. 화면이 같으면 결과를 유지하고, 대사가 바뀌면 바로 갈아끼웁니다.
4. 글자가 너무 많으면 `하단만 / 중앙만 / 상단만`으로 범위를 줄일 수 있습니다.
5. 카메라가 안 되면 **사진 선택**으로 캡처를 넣어도 됩니다.

아이패드는 가로가 편합니다. 사파리에서 공유 → 홈 화면에 추가하면 앱처럼 열립니다.

## GitHub에 올리고 웹으로 켜기

이 폴더(`english-game-translator`)만 올리면 됩니다. 바깥의 플래너·브로셔 파일은 넣지 마세요.

### 방법 A. 사이트에서 올리기 (Git 없어도 됨)

1. [github.com/new](https://github.com/new)에서 저장소를 만듭니다.  
   이름 예: `english-game-translator`  
   **Add a README**는 체크하지 않아도 됩니다.
2. 만든 저장소에서 **uploading an existing file**을 누릅니다.
3. 이 폴더 안의 파일을 모두 끌어다 놓고 **Commit changes**를 누릅니다.
   - `index.html`
   - `manifest.webmanifest`
   - `favicon.svg`
   - `README.md`
4. 저장소 **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` (또는 `master`), 폴더 `/ (root)`
   - Save
5. 1~2분 뒤 주소가 생깁니다.

```
https://아이디.github.io/english-game-translator/
```

핸드폰·아이패드는 이 주소를 열면 됩니다. GitHub Pages는 HTTPS라 카메라가 됩니다.

### 방법 B. Git으로 올리기

```bash
cd english-game-translator
git init -b main
git add .
git commit -m "Add live camera English game translator web app"
git remote add origin https://github.com/아이디/english-game-translator.git
git push -u origin main
```

그다음 Settings → Pages에서 위와 같이 켭니다.

## 알아둘 점

- 첫 실행만 문자 인식 엔진을 받아서 조금 기다립니다.
- 번역·사전은 인터넷이 필요합니다. 서버나 API 키는 없어도 됩니다.
- 게임 전용 폰트, 이펙트, 작은 글자는 가끔 오인식이 납니다. 화면을 가까이 비추거나, 메뉴 숫자가 너무 많으면 영역을 `하단만`으로 줄이면 됩니다.
- `index.html`을 파일로 직접 열면(`file://`) 아이폰·아이패드에서 카메라가 막히는 경우가 많습니다. Pages 주소로 여세요.

## 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면, 카메라, OCR, 번역, 단어, 문법 |
| `manifest.webmanifest` | 홈 화면 추가(PWA) |
| `favicon.svg` | 아이콘 |
