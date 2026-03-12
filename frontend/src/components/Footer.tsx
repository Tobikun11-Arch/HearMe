const Footer = () => {
  return (
    <footer className="border-t border-border py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="text-lg font-bold text-foreground">💙 HearMe</span>
            <p className="text-sm text-muted-foreground mt-1">Learn sign language. Free and accessible.</p>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              View Code Repository
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              Hackathon Submission
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
              Credits
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 HearMe. All rights reserved.</p>
          <p className="text-xs">HearMe saves your progress locally. No account needed.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
