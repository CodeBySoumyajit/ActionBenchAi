import { Link } from "wouter";
import { Scale, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1a3c6e] flex flex-col items-center justify-center text-white p-4">
      <Scale className="h-12 w-12 text-amber-400 mb-4" />
      <p className="text-sm text-blue-300 mb-2">ActionBenchAI</p>
      <h1 className="text-6xl font-bold mb-2">404</h1>
      <p className="text-xl text-blue-200 mb-6">Page not found</p>
      <Link href="/">
        <Button className="bg-white text-[#1a3c6e] hover:bg-blue-50">
          <Home className="h-4 w-4 mr-2" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
