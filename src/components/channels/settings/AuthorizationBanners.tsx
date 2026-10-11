import React, { useState } from 'react';
import { Button, Badge } from '@/components/ui/ds';
import { RefreshCw } from 'lucide-react';
import Aviso from '@/components/base/Aviso';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import { useGlobalConfig } from '@/contexts/GlobalConfigContext';
import ChannelsService from '@/services/channels/channelsService';
import WhatsappService from '@/services/channels/whatsappService';
import instagramService from '@/services/channels/instagramService';
import EmailOauthService from '@/services/channels/emailOauthService';

interface AuthorizationBannersProps {
  inbox: any;
  onReauthorize: (provider: string) => void;
}

// Facebook/Instagram Reauthorization
const FacebookReauthorizeBanner: React.FC<{
  inbox: any;
  onReauthorize: () => void;
}> = ({ onReauthorize }) => {
  const { t } = useLanguage('channels');
  const [isReauthorizing, setIsReauthorizing] = useState(false);

  const handleReauthorize = () => {
    setIsReauthorizing(true);
    onReauthorize();
    // Reset loading state after a delay (the actual process will handle completion)
    setTimeout(() => setIsReauthorizing(false), 2000);
  };

  return (
    <Aviso
      tom="erro"
      titulo={t('settings.authorizationBanners.facebook.title')}
      acao={
        <Button
          onClick={handleReauthorize}
          loading={isReauthorizing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('settings.authorizationBanners.facebook.button')}
        </Button>
      }
    >
      {t('settings.authorizationBanners.facebook.description')}
    </Aviso>
  );
};

// Google/Gmail Reauthorization
const GoogleReauthorizeBanner: React.FC<{
  inbox: any;
  onReauthorize: () => void;
}> = ({ onReauthorize }) => {
  const { t } = useLanguage('channels');
  const [isReauthorizing, setIsReauthorizing] = useState(false);

  const handleReauthorize = () => {
    setIsReauthorizing(true);
    onReauthorize();
    setTimeout(() => setIsReauthorizing(false), 2000);
  };

  return (
    <Aviso
      tom="atencao"
      titulo={t('settings.authorizationBanners.google.title')}
      acao={
        <Button
          onClick={handleReauthorize}
          loading={isReauthorizing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('settings.authorizationBanners.google.button')}
        </Button>
      }
    >
      {t('settings.authorizationBanners.google.description')}
    </Aviso>
  );
};

// Microsoft/Outlook Reauthorization
const MicrosoftReauthorizeBanner: React.FC<{
  inbox: any;
  onReauthorize: () => void;
}> = ({ onReauthorize }) => {
  const { t } = useLanguage('channels');
  const [isReauthorizing, setIsReauthorizing] = useState(false);

  const handleReauthorize = () => {
    setIsReauthorizing(true);
    onReauthorize();
    setTimeout(() => setIsReauthorizing(false), 2000);
  };

  return (
    <Aviso
      tom="info"
      titulo={t('settings.authorizationBanners.microsoft.title')}
      acao={
        <Button
          onClick={handleReauthorize}
          loading={isReauthorizing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('settings.authorizationBanners.microsoft.button')}
        </Button>
      }
    >
      {t('settings.authorizationBanners.microsoft.description')}
    </Aviso>
  );
};

// Instagram Duplicate Inbox Banner
const InstagramDuplicateBanner: React.FC<{
  inbox: any;
  onResolve: () => void;
}> = ({ onResolve }) => {
  const { t } = useLanguage('channels');
  return (
    <Aviso
      tom="atencao"
      titulo={t('settings.authorizationBanners.instagram.duplicate.title')}
      acao={
        <>
          <Button
            onClick={onResolve}
            size="sm"
            variant="outline"
          >
            {t('settings.authorizationBanners.instagram.duplicate.resolveButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
          >
            {t('settings.authorizationBanners.instagram.duplicate.detailsButton')}
          </Button>
        </>
      }
    >
      {t('settings.authorizationBanners.instagram.duplicate.description')}
    </Aviso>
  );
};

// Success Banner (when authorization is valid)
const AuthorizationSuccessBanner: React.FC<{
  provider: string;
  lastConnected?: string;
  inbox: any;
  onReauthorize: (provider: string) => void;
}> = ({ provider, lastConnected, inbox, onReauthorize }) => {
  const { t } = useLanguage('channels');
  const config = useGlobalConfig();
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Load Facebook SDK (same logic as FacebookChannelForm)
  async function loadFBsdk(appId: string) {
    if (window.FB && window.FB.getLoginStatus) {
      const currentAppId = window.FB.getAppId?.();
      if (currentAppId !== appId) {
        window.FB.init({
          appId: appId,
          cookie: true,
          xfbml: true,
          version: config.fbApiVersion || 'v21.0',
        });
      }
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        window.fbAsyncInit = function () {
          window.FB.init({
            appId: appId,
            cookie: true,
            xfbml: true,
            version: config.fbApiVersion || 'v21.0',
          });
          resolve();
        };
        const checkInterval = setInterval(() => {
          if (window.FB && window.FB.getLoginStatus) {
            clearInterval(checkInterval);
            if (window.fbAsyncInit) window.fbAsyncInit();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.FB) reject(new Error('Facebook SDK failed to load'));
        }, 10000);
        return;
      }

      window.fbAsyncInit = function () {
        window.FB.init({
          appId: appId,
          cookie: true,
          xfbml: true,
          version: config.fbApiVersion || 'v21.0',
        });
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('ScriptLoaderError'));
      document.head.appendChild(script);
    });
  }

  const handleReconnectFacebook = async () => {
    setIsReconnecting(true);
    try {
      if (!config.fbAppId) {
        toast.error(t('settings.authorizationBanners.success.facebookNotConfigured'));
        return;
      }

      await loadFBsdk(config.fbAppId);

      if (!window.FB || !window.FB.login) {
        toast.error(t('settings.authorizationBanners.success.sdkNotLoaded'));
        return;
      }

      window.FB.login(
        (response: any) => {
          // Wrap async logic in IIFE to avoid passing async function directly
          (async () => {
            if (response.status === 'connected') {
              try {
                // Use reauthorize_page endpoint (same as the old Vue implementation)
                // This endpoint handles finding the page and updating tokens automatically
                await ChannelsService.reauthorizeFacebookPage(
                  response.authResponse.accessToken,
                  inbox.id,
                );
                toast.success(t('settings.authorizationBanners.success.reconnected'));
                // Reload page to refresh connection status
                setTimeout(() => window.location.reload(), 1000);
              } catch (error: any) {
                console.error('Error reconnecting Facebook:', error);
                toast.error(
                  error?.message || t('settings.authorizationBanners.success.reconnectError'),
                );
                setIsReconnecting(false);
              }
            } else {
              setIsReconnecting(false);
              toast.error(t('settings.authorizationBanners.success.loginCancelled'));
            }
          })().catch((error: any) => {
            console.error('Error in Facebook reconnect callback:', error);
            setIsReconnecting(false);
          });
        },
        {
          scope:
            'pages_manage_metadata,business_management,pages_messaging,pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,pages_manage_engagement',
        },
      );
    } catch (error: any) {
      console.error('Error reconnecting Facebook:', error);
      toast.error(error?.message || t('settings.authorizationBanners.success.reconnectError'));
      setIsReconnecting(false);
    }
  };

  const handleReconnectInstagram = async () => {
    setIsReconnecting(true);
    try {
      if (!config.instagramAppId) {
        toast.error(t('settings.authorizationBanners.success.instagramNotConfigured'));
        return;
      }

      // Use the same logic as InstagramForm
      const response = await instagramService.generateAuthorization();
      window.location.href = response.url;
    } catch (error: any) {
      console.error('Error reconnecting Instagram:', error);
      toast.error(error?.message || t('settings.authorizationBanners.success.reconnectError'));
      setIsReconnecting(false);
    }
  };

  const handleReconnectWhatsApp = async () => {
    setIsReconnecting(true);
    try {
      if (!config.wpAppId || !config.wpWhatsappConfigId) {
        toast.error(t('settings.authorizationBanners.success.whatsappNotConfigured'));
        return;
      }

      await loadFBsdk(config.wpAppId);

      if (!window.FB || !window.FB.login) {
        toast.error(t('settings.authorizationBanners.success.sdkNotLoaded'));
        return;
      }

      window.FB.init({
        appId: config.wpAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v19.0',
      });

      window.FB.login(
        (response: any) => {
          // Wrap async logic in IIFE to avoid passing async function directly
          (async () => {
            if (response.status === 'connected') {
              try {
                // Use embedded signup event (same as WhatsappCloudForm)
                window.FB.Event.subscribe('messenger_platform_embedded_signup', (data: any) => {
                  // Wrap async logic in IIFE
                  (async () => {
                    try {
                      const payload = {
                        user_access_token: response.authResponse.accessToken,
                        waba_id: data.waba_id,
                        phone_number_id: data.phone_number_id,
                        inbox_id: inbox.id,
                      };

                      await WhatsappService.createWhatsappCloudChannel(payload);
                      toast.success(t('settings.authorizationBanners.success.reconnected'));
                      setTimeout(() => window.location.reload(), 1000);
                    } catch (error: any) {
                      console.error('Error reconnecting WhatsApp:', error);
                      toast.error(
                        error?.message || t('settings.authorizationBanners.success.reconnectError'),
                      );
                    } finally {
                      setIsReconnecting(false);
                    }
                  })().catch((error: any) => {
                    console.error('Error in WhatsApp reconnect callback:', error);
                    setIsReconnecting(false);
                  });
                });
              } catch (error: any) {
                console.error('Error setting up WhatsApp reconnection:', error);
                toast.error(
                  error?.message || t('settings.authorizationBanners.success.reconnectError'),
                );
                setIsReconnecting(false);
              }
            } else {
              setIsReconnecting(false);
              toast.error(t('settings.authorizationBanners.success.loginCancelled'));
            }
          })().catch((error: any) => {
            console.error('Error in WhatsApp reconnect callback:', error);
            setIsReconnecting(false);
          });
        },
        {
          config_id: config.wpWhatsappConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
          },
        },
      );
    } catch (error: any) {
      console.error('Error reconnecting WhatsApp:', error);
      toast.error(error?.message || t('settings.authorizationBanners.success.reconnectError'));
      setIsReconnecting(false);
    }
  };

  const handleReconnectGoogle = async () => {
    setIsReconnecting(true);
    try {
      // Get email from inbox channel
      const email = inbox.channel?.email || inbox.email;
      if (!email) {
        toast.error(t('settings.authorizationBanners.success.emailRequired'));
        setIsReconnecting(false);
        return;
      }

      // Use the same logic as EmailForm
      const response = await EmailOauthService.generateGoogleAuthorization(email);
      if (response?.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      console.error('Error reconnecting Google:', error);
      toast.error(error?.message || t('settings.authorizationBanners.success.reconnectError'));
      setIsReconnecting(false);
    }
  };

  const handleReconnectMicrosoft = async () => {
    setIsReconnecting(true);
    try {
      // Get email from inbox channel
      const email = inbox.channel?.email || inbox.email;
      if (!email) {
        toast.error(t('settings.authorizationBanners.success.emailRequired'));
        setIsReconnecting(false);
        return;
      }

      // Use the same logic as EmailForm
      const response = await EmailOauthService.generateMicrosoftAuthorization(email);
      if (response?.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      console.error('Error reconnecting Microsoft:', error);
      toast.error(error?.message || t('settings.authorizationBanners.success.reconnectError'));
      setIsReconnecting(false);
    }
  };

  const handleReconnect = async () => {
    const providerLower = provider.toLowerCase();

    if (providerLower === 'facebook') {
      await handleReconnectFacebook();
    } else if (providerLower === 'instagram') {
      await handleReconnectInstagram();
    } else if (providerLower === 'whatsapp') {
      await handleReconnectWhatsApp();
    } else if (providerLower === 'gmail' || providerLower === 'google') {
      await handleReconnectGoogle();
    } else if (providerLower === 'microsoft' || providerLower === 'outlook') {
      await handleReconnectMicrosoft();
    } else {
      // For other providers, use the onReauthorize callback
      onReauthorize(providerLower);
    }
  };

  // Mostrar botão de reconectar apenas para providers específicos
  // Para WhatsApp, apenas mostrar se for WhatsApp Cloud (provider === 'whatsapp' e inbox.provider === 'whatsapp_cloud')
  const providerLower = provider.toLowerCase();
  const isWhatsAppCloud = providerLower === 'whatsapp' && inbox?.provider === 'whatsapp_cloud';
  const showReconnectButton =
    ['facebook', 'instagram', 'gmail', 'google', 'microsoft', 'outlook'].includes(providerLower) ||
    isWhatsAppCloud;

  return (
    <Aviso
      tom="sucesso"
      titulo={
        <span className="flex flex-wrap items-center gap-2">
          {t('settings.authorizationBanners.success.connectedWith', { provider })}
          <Badge
            variant="default"
            className="bg-primary text-primary-foreground dark:text-primary-foreground"
          >
            {t('settings.authorizationBanners.success.active')}
          </Badge>
        </span>
      }
      acao={
        showReconnectButton && (
          <Button
            onClick={() => {
              handleReconnect().catch(error => {
                console.error('Error in handleReconnect:', error);
              });
            }}
            loading={isReconnecting}
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('settings.authorizationBanners.success.reconnect')}
          </Button>
        )
      }
    >
      {lastConnected && (
        <p>{t('settings.authorizationBanners.success.lastConnection', { date: lastConnected })}</p>
      )}
    </Aviso>
  );
};

const AuthorizationBanners: React.FC<AuthorizationBannersProps> = ({ inbox, onReauthorize }) => {
  if (!inbox) return null;

  const channelType = inbox.channel_type;
  const provider = inbox.provider;
  const reauthorizationRequired = inbox.reauthorization_required;

  // Helper function to handle reauthorization
  const handleReauthorize = (providerType: string) => {
    // Redirect to OAuth flow
    const baseUrl = window.location.origin;
    let redirectUrl = '';

    switch (providerType) {
      case 'facebook':
        redirectUrl = `${baseUrl}/api/v1/callbacks/facebook`;
        window.location.href = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${
          process.env.REACT_APP_FB_APP_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUrl,
        )}&scope=pages_manage_metadata,business_management,pages_messaging,pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,pages_manage_engagement`;
        break;
      case 'google':
        redirectUrl = `${baseUrl}/api/v1/callbacks/google`;
        window.location.href = `https://accounts.google.com/oauth/authorize?client_id=${
          process.env.REACT_APP_GOOGLE_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUrl,
        )}&scope=https://www.googleapis.com/auth/gmail.readonly&response_type=code`;
        break;
      case 'microsoft':
        redirectUrl = `${baseUrl}/api/v1/callbacks/microsoft`;
        window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${
          process.env.REACT_APP_MS_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUrl,
        )}&scope=https://graph.microsoft.com/Mail.Read&response_type=code`;
        break;
      default:
        console.warn('Provider não suportado para reautorização:', providerType);
    }

    onReauthorize(providerType);
  };

  const banners = [];

  // Facebook/Instagram reauthorization
  if (
    (channelType === 'Channel::FacebookPage' || channelType === 'Channel::Instagram') &&
    reauthorizationRequired
  ) {
    banners.push(
      <FacebookReauthorizeBanner
        key="facebook-reauth"
        inbox={inbox}
        onReauthorize={() => handleReauthorize('facebook')}
      />,
    );
  }

  // Google/Gmail reauthorization
  if (channelType === 'Channel::Email' && provider === 'google' && reauthorizationRequired) {
    banners.push(
      <GoogleReauthorizeBanner
        key="google-reauth"
        inbox={inbox}
        onReauthorize={() => handleReauthorize('google')}
      />,
    );
  }

  // Microsoft/Outlook reauthorization
  if (channelType === 'Channel::Email' && provider === 'microsoft' && reauthorizationRequired) {
    banners.push(
      <MicrosoftReauthorizeBanner
        key="microsoft-reauth"
        inbox={inbox}
        onReauthorize={() => handleReauthorize('microsoft')}
      />,
    );
  }

  // Instagram duplicate detection
  if (channelType === 'Channel::Instagram' && inbox.duplicate_inbox_detected) {
    banners.push(
      <InstagramDuplicateBanner key="instagram-duplicate" inbox={inbox} onResolve={() => {}} />,
    );
  }

  // Success banners (when everything is working)
  if (!reauthorizationRequired) {
    if (channelType === 'Channel::FacebookPage') {
      banners.push(
        <AuthorizationSuccessBanner
          key="facebook-success"
          provider="Facebook"
          lastConnected={inbox.last_connected_at}
          inbox={inbox}
          onReauthorize={handleReauthorize}
        />,
      );
    } else if (channelType === 'Channel::Instagram') {
      banners.push(
        <AuthorizationSuccessBanner
          key="instagram-success"
          provider="Instagram"
          lastConnected={inbox.last_connected_at}
          inbox={inbox}
          onReauthorize={handleReauthorize}
        />,
      );
    } else if (channelType === 'Channel::Whatsapp' && provider === 'whatsapp_cloud') {
      banners.push(
        <AuthorizationSuccessBanner
          key="whatsapp-success"
          provider="WhatsApp"
          lastConnected={inbox.last_connected_at}
          inbox={inbox}
          onReauthorize={handleReauthorize}
        />,
      );
    } else if (channelType === 'Channel::Email' && provider === 'google') {
      banners.push(
        <AuthorizationSuccessBanner
          key="google-success"
          provider="Gmail"
          lastConnected={inbox.last_connected_at}
          inbox={inbox}
          onReauthorize={handleReauthorize}
        />,
      );
    } else if (channelType === 'Channel::Email' && provider === 'microsoft') {
      banners.push(
        <AuthorizationSuccessBanner
          key="microsoft-success"
          provider="Microsoft"
          lastConnected={inbox.last_connected_at}
          inbox={inbox}
          onReauthorize={handleReauthorize}
        />,
      );
    }
  }

  if (banners.length === 0) return null;

  return <div className="space-y-4">{banners}</div>;
};

export default AuthorizationBanners;
