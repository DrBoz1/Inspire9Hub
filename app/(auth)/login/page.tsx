import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      <div className="flex w-full flex-col justify-center bg-[#F3F3F3] px-8 md:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/*placeholder for logo (later fr) */}
          <div className="mb-8 flex justify-center md:justify-start">
            <div className="h-20 w-48 bg-transparent flex items-center justify-center italic text-red-600 text-4xl font-bold">
              Inspire9
            </div>
          </div>
          <form className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-400">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="bg-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-gray-400">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="bg-white"
              />
            </div>
            <Button className="w-1/2 bg-[#E31E24] hover:bg-[#c1191f] text-white">
              Login Inspire9
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link href="/signup" className="text-gray-400 hover:text-gray-600">
              Sign Up!
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link href="#" className="text-gray-400 hover:text-gray-600">
              Forget Password? Click Here
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden w-1/2 bg-gray-200 lg:block relative">
        {/*Replace ts later, add a custom div for an image later (idk where I put the image ffs) */}
        <div className="absolute inset-0 bg-zinc-900/10 flex items-center justify-center text-white text-xl">
          A random group idk
        </div>
      </div>
    </div>
  );
}
