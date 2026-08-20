import type { Metadata } from "next";

export const metadata: Metadata = { title: "Phyu" };

const menuItems = [
  { emoji: "🍰", name: "Matcha Strawberry Cake", desc: "Soft & dreamy — just like Phyu" },
  { emoji: "🍡", name: "Mochi Trio", desc: "Strawberry, matcha, sweet potato" },
  { emoji: "🧁", name: "Pink Bunny Cupcake", desc: "Fluffy frosting with bunny ears" },
  { emoji: "🍓", name: "Fresh Strawberry Box", desc: "Hand-picked, always fresh" },
  { emoji: "🍵", name: "Hello Kitty Tea", desc: "Chamomile blend with honey" },
  { emoji: "🥐", name: "Butter Croissant", desc: "Flaky, golden, made with love" },
];

const funFacts = [
  "Phyu is the best manager ever 💕",
  "Phyu loves eating more than anything 🍜",
  "Phyu makes our team sweeter than cake 🎂",
  "Phyu's favorite food: everything (she won't tell us which) 😋",
];

export default function PhyuPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* HEADER */}
      <div className="text-center">
        <div className="text-7xl mb-4 select-none">🐱</div>
        <h1 className="font-mono text-3xl font-bold text-pink-400 sm:text-4xl">
          Welcome to{" "}
          <span className="text-pink-500">Phyu&apos;s</span> Corner ✿
        </h1>
        <p className="mt-3 font-mono text-sm text-pink-300/70">
          ♡ a sweet little place for our amazing manager ♡
        </p>
      </div>

      {/* GREETING */}
      <div className="mt-10 rounded-2xl border-2 border-pink-200 bg-pink-50/50 p-6 text-center">
        <p className="font-mono text-sm text-pink-600">
          “Hello! I&apos;m Phyu&apos;s website, made with love and sprinkles!
          🎀”
        </p>
        <div className="mt-4 flex justify-center gap-2 text-2xl">
          {["💕", "🌸", "🍰", "🍓", "🎀"].map((e) => (
            <span key={e} className="animate-bounce">
              {e}
            </span>
          ))}
        </div>
      </div>

      {/* FAVORITE FOODS */}
      <h2 className="mt-12 font-mono text-lg font-bold text-pink-400">
        <span className="text-pink-500">♡</span> Phyu&apos;s Favorite Foods
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {menuItems.map((item) => (
          <div
            key={item.name}
            className="rounded-xl border border-pink-200 bg-white/60 p-4 transition hover:border-pink-400 hover:bg-pink-50"
          >
            <div className="text-3xl">{item.emoji}</div>
            <h3 className="mt-2 font-mono text-sm font-bold text-pink-600">
              {item.name}
            </h3>
            <p className="mt-1 text-xs text-pink-400/80">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* FUN FACTS */}
      <h2 className="mt-12 font-mono text-lg font-bold text-pink-400">
        <span className="text-pink-500">♡</span> Fun Facts About Phyu
      </h2>
      <div className="mt-5 space-y-2">
        {funFacts.map((fact, i) => (
          <div
            key={i}
            className="rounded-xl border border-pink-200 bg-white/40 px-5 py-3 font-mono text-sm text-pink-600"
          >
            <span className="mr-2 text-pink-400">❀</span>
            {fact}
          </div>
        ))}
      </div>

      {/* QUOTE */}
      <div className="mt-12 rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/30 p-6 text-center">
        <p className="font-mono text-sm italic text-pink-500">
          &ldquo;The secret ingredient in everything Phyu does is LOVE... and
          maybe a little bit of extra seasoning!&rdquo;
        </p>
        <p className="mt-3 font-mono text-xs text-pink-400/60">
          — Someone who knows Phyu well 😊
        </p>
      </div>

      {/* CUTE FOOTER */}
      <div className="mt-10 text-center">
        <p className="font-mono text-xs text-pink-300/50">
          Made with 💕 for the best manager ever
        </p>
        <p className="mt-1 font-mono text-xs text-pink-300/40">
          ʕ •ᴥ•ʔ Live, Laugh, Eat More ✿
        </p>
      </div>
    </div>
  );
}
