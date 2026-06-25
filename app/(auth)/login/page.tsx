import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../actions";

type SearchParams = Promise<{ error?: string; message?: string }>;
export default async function LoginPage(props: { searchParams: SearchParams }) {
  const searchParams = (await props.searchParams) || {};
  const error = searchParams.error;
  const message = searchParams.message;
  return (
    <div className="flex min-h-screen w-full">
      <div className="flex w-full flex-col justify-center bg-[#F3F3F3] px-8 md:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex justify-center">
            <Image
              src="/images/inspire9Logo.png"
              alt="Inspire9 Logo"
              width={180}
              height={60}
              className="h-15 w-auto"
            />
          </div>
          <form action={login} className="space-y-4">
            {message && (
              <div className="p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-center font-medium">
                {message}
              </div>
            )}
            {error && (
              <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-400">
                Email
              </Label>
              <Input
                name="email"
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
                name="password"
                id="password"
                type="password"
                placeholder="Enter your password"
                className="bg-white"
              />
            </div>
            <div className="flex justify-center">
              <Button className="w-fit bg-[#E31E24] hover:bg-[#c1191f] text-white rounded-md text-md transition-all">
                Login Inspire9
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link href="/signup" className="text-gray-400 hover:text-gray-600">
              Sign Up!
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-gray-400 hover:text-[#E31E24] transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden w-1/2 bg-gray-200 lg:block relative">
        <Image
          src="/images/login-side.jpg"
          alt="coworking space image"
          fill
          sizes="(min-width: 1024px) 50vw, 0vw"
          priority
          className="object-cover"
        />
      </div>
    </div>
  );
}
