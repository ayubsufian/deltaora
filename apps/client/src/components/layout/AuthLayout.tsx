import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-600/10 blur-[120px]" />
      
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-3xl tracking-tight mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
               <span className="text-white text-2xl leading-none mt-1">Δ</span>
            </div>
            Deltaora
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            AI-Powered Website Change Monitoring
          </p>
        </div>
        
        <Outlet />
      </div>
    </div>
  );
}
