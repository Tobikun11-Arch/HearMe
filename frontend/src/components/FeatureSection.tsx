import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  examples: string;
  delay?: number;
}

const FeatureCard = ({ title, description, icon, examples, delay = 0 }: FeatureCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
    viewport={{ once: true }}
    className="bg-card p-6 sm:p-8 rounded-xl transition-shadow duration-200 hover:shadow-lg"
    style={{ boxShadow: "0 0 0 1px hsl(216 34% 91%), 0 1px 3px rgba(0,0,0,.04)" }}
  >
    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-3xl mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed mb-3">{description}</p>
    <p className="text-xs text-accent font-medium">{examples}</p>
  </motion.div>
);

const FeatureSection = () => {
  const features = [
    {
      title: "Greetings",
      description:
        "Start with the basics — learn how to introduce yourself and be polite in any conversation.",
      icon: "👋",
      examples: "hello, thank you, good morning"
    },
    {
      title: "Needs",
      description: "Express what you need clearly so others can help and understand you.",
      icon: "🤲",
      examples: "I'm hungry, I need help, water"
    },
    {
      title: "Emotions",
      description: "Share how you feel with expressive signs that connect you to others.",
      icon: "💛",
      examples: "happy, sad, angry, scared"
    },
    {
      title: "Safety Phrases",
      description: "Critical signs everyone should know for emergencies and urgent situations.",
      icon: "🛡️",
      examples: "danger, stop, fire, help me"
    }
  ];

  return (
    <section id="learn" className="py-24 sm:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">What you'll learn</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Four essential categories to get you communicating with confidence.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
