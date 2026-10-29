/** Laravel's default error page (errors::minimal), which the old app showed for every 404. */
export function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen justify-center bg-white text-black sm:items-center sm:pt-0" role="main">
      <div className="mx-auto max-w-xl sm:px-6 lg:px-8">
        <div className="flex items-center pt-8 sm:justify-start sm:pt-0">
          <h1 className="border-r border-gray-400 px-4 text-lg text-black">404</h1>
          <div className="ml-4 text-lg text-black">Not Found</div>
        </div>
      </div>
    </div>
  );
}
