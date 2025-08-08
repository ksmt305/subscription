// --- 設定項目 ---
// GAS(Google Apps Script)のWebアプリのURL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzLwWhGXcwHC5ydZTZiTKvWB4pfX9XsBUlN8giIcjNqEXDEYVppdCHKh8FtTESEA3bJ/exec';
// --- 設定項目ここまで ---


let googleUser = null;

/**
 * Googleログイン後のコールバック関数
 */
function handleCredentialResponse(response) {
    const id_token = response.credential;
    // ログイン情報をローカルストレージに保存
    localStorage.setItem('google_id_token', id_token);
    // 状態確認のためにGASへリダイレクト
    window.location.href = `${GAS_WEB_APP_URL}?action=checkStatus&id_token=${id_token}`;
}

/**
 * JWTをデコードする
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

/**
 * サブスクリプションの状態に応じてUIを更新する
 */
function updateSubscriptionUI(status) {
    const statusEl = document.getElementById('subscription-status');
    const subscribeLink = document.getElementById('subscribe-link');
    const memberContent = document.getElementById('member-content');

    if (status === 'active') {
        statusEl.textContent = '有効';
        statusEl.classList.add('active');
        statusEl.classList.remove('inactive');
        subscribeLink.style.display = 'none';
        memberContent.style.display = 'block';
    } else {
        statusEl.textContent = '未登録';
        statusEl.classList.add('inactive');
        statusEl.classList.remove('active');
        subscribeLink.style.display = 'inline-block';
        memberContent.style.display = 'none';
    }
}

/**
 * ログアウト処理
 */
function logout() {
    localStorage.removeItem('google_id_token');
    googleUser = null;
    google.accounts.id.disableAutoSelect();
    // ログイン画面に戻す
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('user-view').style.display = 'none';
}

// --- ページ読み込み時の処理 ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionStatus = urlParams.get('status');
    const id_token = localStorage.getItem('google_id_token');

    if (id_token) {
        googleUser = {
            profile: parseJwt(id_token),
            id_token: id_token
        };
    }

    if (subscriptionStatus && googleUser) {
        // GASからのリダイレクト後
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('user-view').style.display = 'block';
        document.getElementById('welcome-message').textContent = `ようこそ、${googleUser.profile.name}さん`;
        
        updateSubscriptionUI(subscriptionStatus);

        // 登録用リンクのURLを設定
        const subscribeLink = document.getElementById('subscribe-link');
        subscribeLink.href = `${GAS_WEB_APP_URL}?action=createCheckoutSession&id_token=${googleUser.id_token}`;

        // URLからステータスパラメータを削除して表示をクリーンにする
        window.history.replaceState({}, document.title, window.location.pathname);

    } else if (googleUser) {
        // ログイン済みだがステータスがない場合 (例: ブラウザバック)
        // 再度ステータス確認
        window.location.href = `${GAS_WEB_APP_URL}?action=checkStatus&id_token=${id_token}`;
    } else {
        // 未ログイン状態
        document.getElementById('login-view').style.display = 'block';
        document.getElementById('user-view').style.display = 'none';
    }

    // ログアウトボタンのイベントリスナー
    document.getElementById('logout-button').addEventListener('click', logout);
});
