import { motion } from "framer-motion";

const ImpactSection = () => {
  return (
    <section className="py-24 sm:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">HearMe breaks the silence.</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Millions of deaf people never had the chance to learn sign language. Now, anyone with a browser
            can start — free, simple, and open to all.
          </p>
          <a
            href="#learn"
            className="inline-flex items-center px-8 py-3.5 rounded-lg bg-accent text-accent-foreground text-base font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.07), 0 4px 8px -2px rgba(0,0,0,.15)" }}
          >
            Start Learning →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ImpactSection;
