import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MissionSection from "@/components/MissionSection";
import DemoSection from "@/components/DemoSection";
import FeatureSection from "@/components/FeatureSection";
import ImpactSection from "@/components/ImpactSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MissionSection />
      <DemoSection />
      <FeatureSection />
      <ImpactSection />
      <Footer />
    </div>
  );
};

export default Index;
