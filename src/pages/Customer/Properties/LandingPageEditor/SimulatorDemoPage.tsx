import { toast } from 'sonner';
import {
  SimulatorFlow,
  type RecommendedItem,
  type SimulatorFinishPayload,
} from '@/features/landing/simulator';
import { propertiesService } from '@/services/properties/propertiesService';

/** Standalone gamified financing simulator (preview/demo).
 *  Real calc engine + real catalog recommendations. Lead persistence to the
 *  CRM is the next wire. */
export default function SimulatorDemoPage() {
  const getRecommendations = async (maxValue: number): Promise<RecommendedItem[]> => {
    const resp = await propertiesService.list({});
    return resp.data
      .filter((p) => p.status === 'active' && p.sale_price != null && p.sale_price <= maxValue)
      .sort((a, b) => (b.sale_price ?? 0) - (a.sale_price ?? 0))
      .slice(0, 4)
      .map((p) => ({
        code: p.code,
        title: p.title,
        price: p.sale_price,
        city: p.address_city,
      }));
  };

  const handleFinish = async (data: SimulatorFinishPayload) => {
    // TODO(next): persist as SiteLead/Contact in the CRM with temperature.
    toast.success(`Lead ${data.name} (${data.result.temperature}) — imóvel até ${data.result.maxPropertyValue}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F0520] to-[#1A0A2E]">
      <SimulatorFlow getRecommendations={getRecommendations} onFinish={handleFinish} />
    </div>
  );
}
