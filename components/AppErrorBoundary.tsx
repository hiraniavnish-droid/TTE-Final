import React from 'react';
import { Compass } from 'lucide-react';
import { reloadLatestApp } from '../lib/appRecovery';
import { localStore } from '../lib/browserStorage';
export class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  declare readonly props: { children: React.ReactNode };
  state: {error: Error | null} = {error:null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error) {
    console.error('CRM page failed to render:', error);
    window.TTERecovery?.recover(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const assetError = window.TTERecovery?.isAssetError(this.state.error);
    return <div className="crm-error"><section className="crm-error-card" role="alert">
      <span className="crm-brand-mark"><Compass size={24}/></span>
      <h1>{navigator.onLine === false ? 'You appear to be offline.' : assetError ? 'A newer CRM version is available.' : 'We couldn’t open this page.'}</h1>
      <p>{navigator.onLine === false ? 'Reconnect to the internet, then reopen the app.' : assetError ? 'This tab is using files from an older release. Reopen the latest app to continue.' : 'Reopen the app to try again. If the problem continues, sign in again or contact your administrator.'}</p>
      <p>Reloading keeps your saved records and local tasks.</p>
      <div className="crm-error-actions"><button onClick={reloadLatestApp}>Reopen latest CRM</button><button onClick={() => {
        ['tte_token','voyageos_user','is_authenticated','auth_expiry'].forEach(key => localStore.removeItem(key));
        window.location.hash = '#/login'; reloadLatestApp();
      }}>Sign in again</button></div>
    </section></div>;
  }
}
