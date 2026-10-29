"use client";

import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * The parts of `@inertiajs/react` the storefront components were written against,
 * rebuilt on Next.js so the components from the Laravel app work unchanged:
 * `usePage`, `Link`, `Head`, `router` and `useForm`.
 *
 * Shared props (Laravel's HandleInertiaRequests::share()) come from the shop layout
 * through `<InertiaProvider>`. Requests that change data go to Route Handlers that
 * answer with JSON, the same contract Inertia had with Laravel:
 *
 * - success: `{ redirect?: string, flash?: { success?, error? } }` — follow the redirect,
 *   or refresh the current page's server data
 * - 422: `{ errors: { field: [messages] } }` — Laravel's validation errors for the form
 * - 409: `{ location: string }` — a full-page redirect to another site (Inertia::location)
 */

export type SharedProps = {
  auth: { user: { id: number; name: string; email: string } | null };
  shopUser: ShopUser | null;
  flash: { success: string | null; error: string | null };
  catalog?: Catalog;
  cartCount?: number;
  siteFooter?: SiteFooter;
  chatSettings?: unknown;
};

type Errors = Record<string, string>;

type VisitOptions = {
  preserveScroll?: boolean;
  preserveState?: boolean;
  replace?: boolean;
  only?: string[];
  headers?: Record<string, string>;
  onBefore?: () => boolean | void;
  onStart?: () => void;
  onSuccess?: (page?: unknown) => void;
  onError?: (errors: Errors) => void;
  onFinish?: () => void;
};

type Method = "get" | "post" | "put" | "patch" | "delete";

type Flash = SharedProps["flash"];

type ContextValue = {
  shared: SharedProps;
  setFlash: (flash: Flash | null) => void;
};

const InertiaContext = createContext<ContextValue | null>(null);

type NextRouter = ReturnType<typeof useRouter>;

// The App Router instance, kept here so the module-level `router` can navigate
let nextRouter: NextRouter | null = null;
let setFlashState: ((flash: Flash | null) => void) | null = null;
const navigateListeners = new Set<() => void>();

export function InertiaProvider({ shared, children }: { shared: SharedProps; children: ReactNode }) {
  const appRouter = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [flash, setFlash] = useState<Flash | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    nextRouter = appRouter;
    setFlashState = setFlash;
  }, [appRouter]);

  // Inertia's `navigate` event fires after every visit, including the first page load
  useEffect(() => {
    if (!firstRender.current) {
      setFlash(null);
    }

    firstRender.current = false;
    navigateListeners.forEach((listener) => listener());
  }, [pathname, searchParams]);

  const value = useMemo<ContextValue>(
    () => ({ shared: flash ? { ...shared, flash } : shared, setFlash }),
    [shared, flash],
  );

  return <InertiaContext.Provider value={value}>{children}</InertiaContext.Provider>;
}

export function usePage<PageProps extends object = Record<string, never>>(): { url: string; props: SharedProps & PageProps } {
  const context = useContext(InertiaContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!context) {
    throw new Error("usePage() must be used inside <InertiaProvider>");
  }

  const query = searchParams.toString();

  return { url: query ? `${pathname}?${query}` : pathname, props: context.shared as SharedProps & PageProps };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  /** Anything but `get` submits the link as a request, like Inertia's `<Link method="post" as="button">`. */
  method?: Method;
  as?: string;
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  replace?: boolean;
  prefetch?: boolean;
};

export function Link({ href, method, as, data, preserveScroll, replace, prefetch = false, children, ...rest }: LinkProps) {
  if (method && method !== "get") {
    const submit = () =>
      method === "delete"
        ? router.delete(href, { data, preserveScroll, replace })
        : router[method](href, data, { preserveScroll, replace });

    if (as === "button") {
      return (
        <button type="button" className={rest.className} onClick={submit}>
          {children}
        </button>
      );
    }

    return (
      <a
        href={href}
        {...rest}
        onClick={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} scroll={!preserveScroll} replace={replace} prefetch={prefetch} {...rest}>
      {children}
    </NextLink>
  );
}

/** The page title, like Inertia's `title: (title) => `${title} - ${appName}``. React hoists it into <head>. */
export function Head({ title }: { title?: string }) {
  return <title>{title ? `${title} - Inofarma` : "Inofarma"}</title>;
}

async function send(method: Method, url: string, data: unknown, options: VisitOptions = {}): Promise<void> {
  if (options.onBefore?.() === false) {
    return;
  }

  options.onStart?.();

  try {
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(method === "get" ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body: method === "get" ? undefined : JSON.stringify(data ?? {}),
      credentials: "same-origin",
    });
    const body = (await response.json().catch(() => ({}))) as {
      redirect?: string;
      location?: string;
      errors?: Record<string, string | string[]>;
      flash?: Partial<Flash>;
      message?: string;
    };

    if (response.status === 409 && body.location) {
      window.location.href = body.location;

      return;
    }

    if (response.status === 422 && body.errors) {
      // Laravel sends a list per field; Inertia showed the first message
      options.onError?.(
        Object.fromEntries(Object.entries(body.errors).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : messages])),
      );

      return;
    }

    if (!response.ok) {
      console.error(`${method.toUpperCase()} ${url} gagal (${response.status})`, body.message ?? body);
      options.onError?.({});

      return;
    }

    if (body.flash) {
      setFlashState?.({ success: body.flash.success ?? null, error: body.flash.error ?? null });
    }

    if (body.redirect) {
      router.visit(body.redirect, { preserveScroll: options.preserveScroll, replace: options.replace });
    } else {
      nextRouter?.refresh();
    }

    options.onSuccess?.();
  } finally {
    options.onFinish?.();
  }
}

export const router = {
  visit(url: string, options: VisitOptions = {}) {
    if (!nextRouter) {
      window.location.href = url;

      return;
    }

    const navigate = options.replace ? nextRouter.replace : nextRouter.push;

    navigate(url, { scroll: !options.preserveScroll });
  },
  get(url: string, options: VisitOptions = {}) {
    router.visit(url, options);
  },
  post: (url: string, data?: unknown, options?: VisitOptions) => send("post", url, data, options),
  put: (url: string, data?: unknown, options?: VisitOptions) => send("put", url, data, options),
  patch: (url: string, data?: unknown, options?: VisitOptions) => send("patch", url, data, options),
  delete: (url: string, options?: VisitOptions & { data?: unknown }) => send("delete", url, options?.data, options),
  /** Re-runs the current page's server components; Inertia's `only` narrows nothing here. */
  reload(options: VisitOptions = {}) {
    nextRouter?.refresh();
    options.onSuccess?.();
    options.onFinish?.();
  },
  /** Only the `navigate` event is supported; returns the unsubscribe function, like Inertia. */
  on(event: "navigate", callback: () => void): () => void {
    if (event !== "navigate") {
      throw new Error(`router.on('${event}') is not supported`);
    }

    navigateListeners.add(callback);

    return () => {
      navigateListeners.delete(callback);
    };
  },
};

type FormOptions = VisitOptions;

/** `useForm(initialValues)` or Inertia's `useForm(rememberKey, initialValues)`; the key is accepted and ignored. */
export function useForm<TForm extends Record<string, unknown>>(rememberKeyOrValues: string | TForm, maybeValues?: TForm) {
  const initialValues = (typeof rememberKeyOrValues === "string" ? maybeValues : rememberKeyOrValues) as TForm;
  const defaults = useRef(initialValues);
  const [data, setDataState] = useState<TForm>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof TForm | string, string>>>({});
  const [processing, setProcessing] = useState(false);
  const [recentlySuccessful, setRecentlySuccessful] = useState(false);
  const transformer = useRef<(data: TForm) => unknown>((value) => value);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
    }
  }, []);

  const setData = useCallback(
    (keyOrValues: keyof TForm | TForm | ((previous: TForm) => TForm), value?: TForm[keyof TForm]) => {
      if (typeof keyOrValues === "function") {
        setDataState((previous) => (keyOrValues as (previous: TForm) => TForm)(previous));
      } else if (typeof keyOrValues === "object") {
        setDataState(keyOrValues as TForm);
      } else {
        setDataState((previous) => ({ ...previous, [keyOrValues]: value }));
      }
    },
    [],
  ) as {
    <K extends keyof TForm>(key: K, value: TForm[K]): void;
    (values: TForm): void;
    (updater: (previous: TForm) => TForm): void;
  };

  const submit = useCallback(
    (method: Method, url: string, options: FormOptions = {}) => {
      setProcessing(true);
      setRecentlySuccessful(false);

      return send(method, url, transformer.current(data), {
        ...options,
        onSuccess: (page) => {
          setErrors({});
          setRecentlySuccessful(true);
          successTimer.current = setTimeout(() => setRecentlySuccessful(false), 2000);
          options.onSuccess?.(page);
        },
        onError: (formErrors) => {
          setErrors(formErrors as Partial<Record<keyof TForm | string, string>>);
          options.onError?.(formErrors);
        },
        onFinish: () => {
          setProcessing(false);
          options.onFinish?.();
        },
      });
    },
    [data],
  );

  return {
    data,
    setData,
    errors,
    hasErrors: Object.keys(errors).length > 0,
    processing,
    recentlySuccessful,
    wasSuccessful: recentlySuccessful,
    transform(callback: (data: TForm) => unknown) {
      transformer.current = callback;
    },
    setError(field: keyof TForm | string, message: string) {
      setErrors((previous) => ({ ...previous, [field]: message }));
    },
    clearErrors(...fields: (keyof TForm | string)[]) {
      setErrors((previous) => {
        if (fields.length === 0) {
          return {};
        }

        const next = { ...previous };

        fields.forEach((field) => delete next[field]);

        return next;
      });
    },
    reset(...fields: (keyof TForm)[]) {
      setDataState((previous) => {
        if (fields.length === 0) {
          return defaults.current;
        }

        const next = { ...previous };

        fields.forEach((field) => {
          next[field] = defaults.current[field];
        });

        return next;
      });
    },
    get: (url: string, options?: FormOptions) => submit("get", url, options),
    post: (url: string, options?: FormOptions) => submit("post", url, options),
    put: (url: string, options?: FormOptions) => submit("put", url, options),
    patch: (url: string, options?: FormOptions) => submit("patch", url, options),
    delete: (url: string, options?: FormOptions) => submit("delete", url, options),
  };
}
