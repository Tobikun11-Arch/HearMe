import { motion } from "framer-motion";

const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="caps-text text-sm font-medium text-accent mb-6"
            >
              Free sign language education
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6"
            >
              Learn to sign.
              <br />
              Free. Accessible.
              <br />
              <span className="text-accent">Human.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10"
            >
              HearMe is your first teacher in sign language — patient, clear, and always here.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <a
                href="#learn"
                className="inline-flex items-center px-8 py-3.5 rounded-lg bg-accent text-accent-foreground text-base font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.07), 0 4px 8px -2px rgba(0,0,0,.15)" }}
              >
                Learn Now →
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <img
              src="/hearme-avatar.png"
              alt="HearMe AI avatar — a friendly sign language teacher"
              className="w-72 sm:w-80 lg:w-96 drop-shadow-2xl"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
