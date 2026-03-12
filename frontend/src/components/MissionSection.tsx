import { motion } from "framer-motion";

const MissionSection = () => {
  return (
    <section id="mission" className="py-24 sm:py-32 bg-card">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <p className="caps-text text-sm font-medium text-accent mb-6">Our Mission</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
            Communication is not a privilege.
            <br />
            It&apos;s a <span className="text-accent">right</span>.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            HearMe gives deaf learners everywhere the chance to speak with their hands and be heard.
            No accounts, no fees — just open your browser and start learning.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default MissionSection;
