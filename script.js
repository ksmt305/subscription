// --- 設定項目 ---
// GAS(Google Apps Script)のWebアプリのURL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbytHGIoXvT8h-ZCiYWKXLPc6ZDiFLZGjSRjZ1MLimL5xDCqpnP3Qo6E7btb9RVIH7Wt/exec';
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
        console.error('JWT parse error:', e);
        return null;
    }
}

/**
 * サーバーにサブスクリプションの状態を確認する (form-submit方式)
 */
function checkSubscriptionStatus() {
    if (!googleUser) {
        console.error('Google user not found');
        updateSubscriptionUI(false);
        return;
    }

    console.log('Checking subscription status...');

    // 既存のフォームがあれば削除
    const existingForm = document.getElementById('temp-check-form');
    if (existingForm) {
        existingForm.remove();
    }

    // 動的にフォームを作成
    const form = document.createElement('form');
    form.id = 'temp-check-form';
    form.method = 'POST';
    form.action = GAS_WEB_APP_URL;
    form.target = 'status_check_iframe';
    form.style.display = 'none';

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
    
    // フォーム送信前にローディング状態を表示
    updateSubscriptionUI(false, 'loading');
    
    // タイムアウト処理を追加
    const timeoutId = setTimeout(() => {
        console.error('Status check timeout');
        updateSubscriptionUI(false);
        alert('ステータス確認がタイムアウトしました。しばらくしてから再度お試しください。');
    }, 10000); // 10秒でタイムアウト
    
    // タイムアウトIDを保存（レスポンス受信時にクリア）
    window.statusCheckTimeoutId = timeoutId;
    
    form.submit();
    
    // フォーム送信後、少し時間をおいてから削除
    setTimeout(() => {
        if (document.getElementById('temp-check-form')) {
            document.getElementById('temp-check-form').remove();
        }
    }, 15000);
}

/**
 * サブスクリプションの状態に応じてUIを更新する
 */
function updateSubscriptionUI(isSubscribed, status = null) {
    const statusEl = document.getElementById('subscription-status');
    const subscribeButtonContainer = document.getElementById('subscribe-button-container');
    const memberContent = document.getElementById('member-content');

    if (status === 'loading') {
        statusEl.textContent = '確認中...';
        statusEl.className = 'loading';
        subscribeButtonContainer.style.display = 'none';
        memberContent.style.display = 'none';
        return;
    }

    if (isSubscribed) {
        statusEl.textContent = '有効';
        statusEl.className = 'active';
        subscribeButtonContainer.style.display = 'none';
        memberContent.style.display = 'block';
    } else {
        statusEl.textContent = '未登録';
        statusEl.className = 'inactive';
        subscribeButtonContainer.style.display = 'block';
        memberContent.style.display = 'none';
    }
}

/**
 * ログアウト処理
 */
function logout() {
    try {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
    } catch (e) {
        console.warn('Google sign out error:', e);
    }
    
    googleUser = null;
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('user-view').style.display = 'none';
    document.getElementById('subscription-status').textContent = '';
    document.getElementById('subscription-status').className = '';
    document.getElementById('member-content').style.display = 'none';
    document.getElementById('subscribe-button-container').style.display = 'block';
}

/**
 * URLパラメータから決済完了を検出
 */
function checkPaymentSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
        // 決済完了後、URLをクリーンアップ
        const url = new URL(window.location);
        url.searchParams.delete('session_id');
        window.history.replaceState({}, document.title, url);
        
        // 決済完了メッセージを表示
        setTimeout(() => {
            alert('決済が完了しました！サブスクリプションが有効になりました。');
            // ステータスを再確認
            if (googleUser) {
                checkSubscriptionStatus();
            }
        }, 1000);
    }
}

// --- イベントリスナー ---
document.addEventListener('DOMContentLoaded', () => {
    // 決済完了チェック
    checkPaymentSuccess();
    
    // ログアウトボタン
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // 購読フォームの送信処理
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function(e) {
            if (!googleUser || !googleUser.id_token) {
                e.preventDefault();
                alert('ログインが必要です。');
                return false;
            }
            
            // フォーム送信前に確認
            if (!confirm('月額1000円のサブスクリプションに登録しますか？')) {
                e.preventDefault();
                return false;
            }
        });
    }

    // GASからのメッセージ(postMessage)を受信
    window.addEventListener('message', (event) => {
        console.log('Message received:', event);
        console.log('Event origin:', event.origin);
        console.log('Event data:', event.data);
        
        // タイムアウトをクリア
        if (window.statusCheckTimeoutId) {
            clearTimeout(window.statusCheckTimeoutId);
            window.statusCheckTimeoutId = null;
        }

        // 開発環境では origin チェックを緩和
        const isDevelopment = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.protocol === 'file:' ||
                             window.location.hostname.includes('github.io');
        
        if (!isDevelopment && GAS_WEB_APP_URL) {
            try {
                // Google Apps Script のドメインを許可
                const allowedOrigins = [
                    'https://script.google.com',
                    'https://script.googleusercontent.com'
                ];
                
                const gasUrl = new URL(GAS_WEB_APP_URL);
                allowedOrigins.push(gasUrl.origin);
                
                if (!allowedOrigins.some(origin => event.origin.includes(origin))) {
                    console.warn("Received message from unknown origin:", event.origin);
                    return;
                }
            } catch (e) {
                console.warn("Origin check failed:", e);
            }
        }

        try {
            let data = event.data;
            
            // データが文字列の場合はパース
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (parseError) {
                    console.error('Failed to parse message data:', parseError);
                    console.log('Raw data:', event.data);
                    // 文字列データをそのまま処理してみる
                    if (event.data.includes('checkStatusResult')) {
                        // 簡易パース試行
                        try {
                            const matches = event.data.match(/"isSubscribed":\s*(true|false)/);
                            if (matches) {
                                const isSubscribed = matches[1] === 'true';
                                updateSubscriptionUI(isSubscribed);
                                return;
                            }
                        } catch (e) {
                            console.error('Simple parse failed:', e);
                        }
                    }
                    updateSubscriptionUI(false);
                    return;
                }
            }

            console.log('Parsed message data:', data);

            if (data && data.action === 'checkStatusResult') {
                if (data.status === 'success') {
                    console.log('Status check successful, isSubscribed:', data.isSubscribed);
                    updateSubscriptionUI(data.isSubscribed);
                } else {
                    console.error('ステータスの確認に失敗しました:', data.message);
                    updateSubscriptionUI(false);
                    if (data.message) {
                        alert('ステータス確認エラー: ' + data.message);
                    }
                }
            } else if (data && data.action === 'error') {
                console.error('GASでエラーが発生しました:', data);
                updateSubscriptionUI(false);
                alert('エラーが発生しました: ' + (data.message || 'Unknown error'));
            } else {
                console.log('Unknown message action:', data);
                // 不明なメッセージでもデフォルトで未登録状態にする
                updateSubscriptionUI(false);
            }

        } catch (error) {
            console.error('Message handling error:', error);
            updateSubscriptionUI(false);
            alert('メッセージ処理中にエラーが発生しました: ' + error.message);
        }
    });

    // iframeのロードエラーをキャッチ
    const hiddenIframe = document.querySelector('iframe[name="hidden_iframe"]');
    if (hiddenIframe) {
        hiddenIframe.addEventListener('error', (e) => {
            console.error('iframe load error:', e);
            if (window.statusCheckTimeoutId) {
                clearTimeout(window.statusCheckTimeoutId);
                window.statusCheckTimeoutId = null;
            }
            updateSubscriptionUI(false);
            alert('通信エラーが発生しました。しばらく待ってから再度お試しください。');
        });
        
        hiddenIframe.addEventListener('load', () => {
            console.log('iframe loaded');
        });
    }

    // ステータスチェック用のiframeも作成
    const statusIframe = document.createElement('iframe');
    statusIframe.name = 'status_check_iframe';
    statusIframe.style.cssText = 'position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; border: none; visibility: hidden;';
    document.body.appendChild(statusIframe);
    
    statusIframe.addEventListener('load', () => {
        console.log('Status check iframe loaded');
    });
    
    statusIframe.addEventListener('error', (e) => {
        console.error('Status iframe error:', e);
        if (window.statusCheckTimeoutId) {
            clearTimeout(window.statusCheckTimeoutId);
            window.statusCheckTimeoutId = null;
        }
        updateSubscriptionUI(false);
    });
});

// グローバルエラーハンドラー
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});

// デバッグ用の手動ステータスチェック関数
function manualStatusCheck() {
    if (!googleUser) {
        alert('先にログインしてください。');
        return;
    }
    
    console.log('Manual status check triggered');
    checkSubscriptionStatus();
}

// デバッグ用の関数をグローバルに公開
window.debugFunctions = {
    manualStatusCheck: manualStatusCheck,
    updateSubscriptionUI: updateSubscriptionUI,
    checkSubscriptionStatus: checkSubscriptionStatus,
    googleUser: () => googleUser
};
