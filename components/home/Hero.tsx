export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-orange-50 to-white px-6 py-20 text-center dark:from-zinc-900 dark:to-black">
      <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        Find your next favorite recipe
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Search thousands of recipes by ingredient, cuisine, or diet.
      </p>
      <form
        action="/search"
        method="GET"
        className="mx-auto mt-8 flex max-w-lg gap-2"
      >
        <input
          type="text"
          name="query"
          placeholder="Search for a recipe or ingredient..."
          className="flex-1 rounded-full border border-zinc-300 px-5 py-3 text-zinc-900 shadow-sm focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="rounded-full bg-orange-600 px-6 py-3 font-medium text-white transition hover:bg-orange-700"
        >
          Search
        </button>
      </form>
    </section>
  );
}
