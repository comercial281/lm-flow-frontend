import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import Aviso from '@/components/base/Aviso';
import { Button } from '@/components/ui/ds';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage('unauthorized');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldX className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900">{t('title')}</h1>
          <p className="text-lg text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Descrição */}
        <div className="bg-white shadow rounded-lg p-6 text-left space-y-4">
          <p className="text-sm text-gray-700">
            {t('description')}
          </p>

          <Aviso tom="atencao" titulo={t('contactAdmin.title')}>
            <p>{t('contactAdmin.message')}</p>
          </Aviso>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('buttons.back')}
          </Button>

          <Button
            onClick={() => navigate('/')}
          >
            <Home className="h-4 w-4" />
            {t('buttons.goHome')}
          </Button>
        </div>

        {/* Informações Adicionais */}
        <div className="text-xs text-gray-500">
          <p>{t('errorCode')}</p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
