"use client";

import ArchitectureSection from "@/components/ArchitectureSection";
import AdapterGuideSection from "@/components/AdapterGuideSection";
import CapabilitiesSection from "@/components/CapabilitiesSection";
import CapabilityMatrix from "@/components/CapabilityMatrix";
import DeveloperSection from "@/components/DeveloperSection";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import Navbar from "@/components/Navbar";
import PlaygroundSection from "@/components/PlaygroundSection";
import WalletsSection from "@/components/WalletsSection";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <CapabilitiesSection />
      <WalletsSection />
      <PlaygroundSection />
      <CapabilityMatrix />
      <ArchitectureSection />
      <AdapterGuideSection />
      <DeveloperSection />
      <Footer />
    </div>
  );
}
