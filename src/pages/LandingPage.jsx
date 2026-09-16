import useSmoothScroll from '../hooks/useSmoothScroll';
import MarketingNav from '../components/marketing/MarketingNav';
import Hero from '../components/marketing/Hero';
import TrustBar from '../components/marketing/TrustBar';
import ProblemSolution from '../components/marketing/ProblemSolution';
import ProductStory from '../components/marketing/ProductStory';
import ForOrganizers from '../components/marketing/ForOrganizers';
import ForPlayers from '../components/marketing/ForPlayers';
import Community from '../components/marketing/Community';
import SportsExpansion from '../components/marketing/SportsExpansion';
import TournamentFlow from '../components/marketing/TournamentFlow';
import Testimonials from '../components/marketing/Testimonials';
import FeatureGrid from '../components/marketing/FeatureGrid';
import Pricing from '../components/marketing/Pricing';
import WhyPerEvent from '../components/marketing/WhyPerEvent';
import FAQ from '../components/marketing/FAQ';
import FinalCTA from '../components/marketing/FinalCTA';
import MarketingFooter from '../components/marketing/MarketingFooter';

export default function LandingPage() {
  useSmoothScroll();

  return (
    <div className="bg-white">
      <MarketingNav />
      <Hero />
      <TrustBar />
      <ProblemSolution />
      <ProductStory />
      <ForOrganizers />
      <ForPlayers />
      <Community />
      <SportsExpansion />
      <TournamentFlow />
      <Testimonials />
      <FeatureGrid />
      <Pricing />
      <WhyPerEvent />
      <FAQ />
      <FinalCTA />
      <MarketingFooter />
    </div>
  );
}
