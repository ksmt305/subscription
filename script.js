// --- 設定項目 ---
// GAS(Google Apps Script)のWebアプリのURL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw02wV5SoEu2TAa_S7uZxEFoa0TNNp4DSvHPaF_glmZzwwxpoZgePgnGFhqNVpARjDC/exec';
// --- 設定項目ここまで ---

let googleUser = null;

/**
 * Googleログイン後のコールバック関数
 */
function handleCredentialResponse(response) {
    const id_token = response.credential;
    const userProfile = parseJwt(id_token);

    googleUser = {
        id: userProfile.sub,
        email: userProfile.email,
        name: userProfile.name,
        id_token: id_token
    };

    document.getElementById('login-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'block';
    document.getElementById('welcome-message').textContent = `ようこそ、${googleUser.name}さん`;
    document.getElementById('id_token_field').value = googleUser.id_token;

    // ログイン後、サブスクリプション状態を確認
    checkSubscriptionStatus();
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
 * サーバーにサブスクリプションの状態を確認する (form-submit方式)
 */
function checkSubscriptionStatus() {
    if (!googleUser) return;

    // 動的にフォームを作成
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GAS_WEB_APP_URL;
    form.target = 'hidden_iframe'; // 非表示のiframeをターゲットに
    form.style.display = 'none'; // フォーム自体は表示しない

    // パラメータを設定
    const params = {
        action: 'checkStatus',
        id_token: googleUser.id_token
    };

    for (const key in params) {
        const hiddenField = document.createElement('input');
        hiddenField.type = 'hidden';
        hiddenField.name = key;
        hiddenField.value = params[key];
        form.appendChild(hiddenField);
    }

    document.body.appendChild(form);
    form.submit();
    // フォームは送信後に削除しても良いが、iframeがロードされるまで残しておく方が安全な場合もある
    // document.body.removeChild(form); 
}

/**
 * サブスクリプションの状態に応じてUIを更新する
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
    document.getElementById('subscribe-button-container').style.display = 'block'; // ログアウト後も表示
}

// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    // ログアウトボタン
    document.getElementById('logout-button').addEventListener('click', logout);

    // GASからのメッセージ(postMessage)を受信
    window.addEventListener('message', (event) => {
        // 送信元のオリジンを確認 (セキュリティ対策)
        const gasOrigin = new URL(GAS_WEB_APP_URL).origin;
        // 開発中はevent.originが異なる場合があるので、本番デプロイ時に厳密にチェック
        if (event.origin !== gasOrigin) {
            // console.warn("Received message from unknown origin:", event.origin);
            // return;
        }

        try {
            const data = event.data; // JSON.parseはGAS側で行うため不要

            if (data && data.action === 'checkStatusResult') {
                if (data.status === 'success') {
                    updateSubscriptionUI(data.isSubscribed);
                } else {
                    console.error('ステータスの確認に失敗しました:', data.message);
                    alert(data.message || 'ステータスの確認に失敗しました。');
                }
            } else if (data && data.action === 'error') {
                console.error('GASでエラーが発生しました:', data.message);
                alert(data.message || 'GASでエラーが発生しました。');
            }

        } catch (error) {
            console.error('Message handling error:', error);
            alert('メッセージ処理中にエラーが発生しました。');
        }
    });
});
