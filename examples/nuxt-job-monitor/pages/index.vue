<template>
  <main class="page">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Nuxt Job Monitor</p>
          <h1 class="title">External async graph ownership demo</h1>
          <p class="subtitle">
            This example compares a Nuxt page that renders an external
            signal-kernel graph with a page that owns the same job monitor state
            directly inside Vue.
          </p>
        </div>

        <nav class="nav">
          <NuxtLink to="/kernel-owned">Kernel-owned</NuxtLink>
          <NuxtLink to="/vue-owned">Vue-owned</NuxtLink>
        </nav>
      </header>

      <section class="two-column">
        <article class="panel">
          <p class="eyebrow">Path A</p>
          <h2 class="panel-title">Kernel-owned graph</h2>
          <p class="subtitle">
            Job state, async resources, mutation resources, invalidation, and
            derived summary state live outside Nuxt. Vue consumes readonly refs
            from `@signal-kernel/vue`.
          </p>
          <NuxtLink class="button primary" to="/kernel-owned">
            Open kernel-owned page
          </NuxtLink>
        </article>

        <article class="panel">
          <p class="eyebrow">Path B</p>
          <h2 class="panel-title">Vue-owned state</h2>
          <p class="subtitle">
            The same transport and UI are wired with Vue `ref`, `computed`, and
            lifecycle hooks. This is valid for ordinary Nuxt state ownership.
          </p>
          <NuxtLink class="button" to="/vue-owned">
            Open Vue-owned page
          </NuxtLink>
        </article>
      </section>
    </div>
  </main>
</template>
