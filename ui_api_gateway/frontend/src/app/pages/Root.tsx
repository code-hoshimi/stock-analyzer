import { Outlet, Link, useLocation } from 'react-router';
import { Home, Menu } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { useState } from 'react';

export function Root() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: Home, label: '市场' },
  ];
  
  const NavContent = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Button
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start gap-2"
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </>
  );
  
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="金叉叉"
                className="w-10 h-10 rounded-lg object-contain"
              />
              <h1 className="text-xl font-bold hidden sm:block">金叉叉</h1>
            </Link>
            
            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-2">
              <NavContent />
            </nav>
            
            {/* 移动端菜单按钮 */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetTitle>导航菜单</SheetTitle>
                <SheetDescription>
                  选择一个页面进行导航
                </SheetDescription>
                <nav className="flex flex-col gap-2 mt-8">
                  <NavContent />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      
      {/* 主要内容区域 */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
      
      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="grid grid-cols-1 gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                  isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* 移动端底部占位，防止内容被底部导航遮挡 */}
      <div className="h-20 md:hidden"></div>
    </div>
  );
}
