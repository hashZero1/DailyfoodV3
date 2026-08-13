import Hero from "@/components/home/Hero";
import TrendingSection from "@/components/home/TrendingSection";
import RandomRecipes from "@/components/home/RandomRecipes";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <TrendingSection />
      <RandomRecipes />
      <Footer />
    </main>
  );
}
