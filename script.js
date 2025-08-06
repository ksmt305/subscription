// --- 設定項目 ---
// GAS(Google Apps Script)のWebアプリのURL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzuKRa72ZKOUhH5mZZ31DENWCrvxTU_mKu-iTjYcyJisEyYHcxwPnCmuJ1mUvXar9xC/exec';
// --- 設定項目ここまで ---

let googleUser = null;

/**
 * Googleログイン後のコールバック関数
 * @param {object} response 認証情報レスポンス
 */
function handleCredentialResponse(response) {
    // IDトークンをデコードしてユーザー情報を取得（簡易的な方法）
    const id_token = response.credential;
    const userProfile = parseJwt(id_token);
    console.log("ID Token: " + id_token);
    console.log('User Profile: ', userProfile);

    googleUser = {
        id: userProfile.sub,
        email: userProfile.email,
        name: userProfile.name,
        id_token: id_token
    };

    // UIを更新
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'block';
    document.getElementById('welcome-message').textContent = `ようこそ、${googleUser.name}さん`;

    // サーバーにユーザー情報を送信してサブスク状態を確認
    checkSubscriptionStatus();
}

/**
 * JWTをデコードする
 * @param {string} token JWT
 * @returns {object} ペイロード
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
 * サーバーにサブスクリプションの状態を確認する
 */
async function checkSubscriptionStatus() {
    if (!googleUser) return;

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'checkStatus',
                id_token: googleUser.id_token
            }),
        });

        const result = await response.json();

        if (result.status === 'success') {
            updateSubscriptionUI(result.isSubscribed);
        } else {
            throw new Error(result.message || 'ステータスの確認に失敗しました。');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    }
}

/**
 * サブスクリプションの状態に応じてUIを更新する
 * @param {boolean} isSubscribed 登録済みかどうか
 */
function updateSubscriptionUI(isSubscribed) {
    const statusEl = document.getElementById('subscription-status');
    const subscribeButtonContainer = document.getElementById('subscribe-button-container');
    const memberContent = document.getElementById('member-content');

    if (isSubscribed) {
        statusEl.textContent = '有効';
        statusEl.classList.add('active');
        statusEl.classList.remove('inactive');
        subscribeButtonContainer.style.display = 'none';
        memberContent.style.display = 'block';
    } else {
        statusEl.textContent = '未登録';
        statusEl.classList.add('inactive');
        statusEl.classList.remove('active');
        subscribeButtonContainer.style.display = 'block';
        memberContent.style.display = 'none';
    }
}


/**
 * ログアウト処理
 */
function logout() {
    google.accounts.id.disableAutoSelect();
    googleUser = null;
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('user-view').style.display = 'none';
    document.getElementById('subscription-status').textContent = '';
    document.getElementById('subscription-status').classList.remove('active', 'inactive');
    document.getElementById('member-content').style.display = 'none';
    document.getElementById('subscribe-button-container').style.display = 'none';
}


// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    // ログアウトボタン
    document.getElementById('logout-button').addEventListener('click', logout);

    // サブスク登録ボタン
    document.getElementById('subscribe-button').addEventListener('click', async () => {
        if (!googleUser) {
            alert('ログインしてください。');
            return;
        }

        try {
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'createCheckoutSession',
                    id_token: googleUser.id_token
                }),
            });

            const result = await response.json();

            if (result.status === 'success' && result.checkoutUrl) {
                // StripeのCheckoutページにリダイレクト
                window.location.href = result.checkoutUrl;
            } else {
                throw new Error(result.message || '決済ページの作成に失敗しました。');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        }
    });
});
