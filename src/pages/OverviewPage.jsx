import StatsBar from '../components/layout/StatsBar';
import CourtsSection from '../components/courts/CourtsSection';

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <StatsBar />
      <CourtsSection />
    </div>
  );
}
