import { motion } from "framer-motion";

const Navbar = () => {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md"
      style={{ boxShadow: "0 0 0 1px hsl(216 34% 91%)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💙</span>
          <span className="text-xl font-bold text-foreground tracking-tight">HearMe</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {["Mission", "Demo", "Learn"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {item}
            </a>
          ))}
        </div>
        <a
          href="#learn"
          className="inline-flex items-center px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.07), 0 2px 4px -1px rgba(0,0,0,.1)" }}
        >
          Learn Now
        </a>
      </div>
    </motion.nav>
  );
};

export default Navbar;
