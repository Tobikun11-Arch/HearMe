import { motion } from "framer-motion";

const DemoSection = () => {
  return (
    <section id="demo" className="py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">See how HearMe works.</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch a quick demo of an interactive lesson with our AI-powered avatar.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="aspect-video rounded-xl bg-muted flex items-center justify-center"
          style={{
            boxShadow: "0 0 0 1px hsl(216 34% 91%), 0 20px 60px -15px rgba(0,0,0,.12)"
          }}
        >
          <div className="text-center">
            <div className="text-5xl mb-4">▶️</div>
            <p className="text-muted-foreground text-sm">Demo video coming soon</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <a
            href="#learn"
            className="inline-flex items-center px-8 py-3.5 rounded-lg bg-accent text-accent-foreground text-base font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.07), 0 4px 8px -2px rgba(0,0,0,.15)" }}
          >
            Try it yourself → Learn Now
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default DemoSection;
