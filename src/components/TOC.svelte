<script>
	import { onMount } from 'svelte';
	import { siteConfig } from "@/config";
	import i18nit from '@i18n/translation'

	let { headings = [], language,} = $props();
	const t = $derived(i18nit(language));

	// 内部状态
	let tocVisible = $state(false);
	let activeSlug = $state('');

	// 基础逻辑计算
	let minDepth = $derived(headings.length > 0 ? Math.min(...headings.map(h => h.depth)) : 0);
	let maxDepth = $derived(minDepth + (siteConfig?.toc?.depth || 2));
	let filteredHeadings = $derived(headings.filter(h => h.depth < maxDepth));

	function handleScroll() {
		tocVisible = (window.scrollY || window.pageYOffset) > 200;
	}

	function initObserver() {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					activeSlug = entry.target.id;
				}
			});
		}, { rootMargin: '-10% 0px -70% 0px', threshold: 0.1 });

		filteredHeadings.forEach(h => {
			const el = document.getElementById(h.slug);
			if (el) observer.observe(el);
		});
		return observer;
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();
		const observer = initObserver();

		return () => {
			window.removeEventListener('scroll', handleScroll);
			observer.disconnect();
		};
	});
</script>

{#if tocVisible && filteredHeadings.length > 0}
	<aside 
		class="fixed top-20 w-[var(--toc-width)] left-[var(--toc-offset-left)] z-10 hidden lg:block text-[var(--text-color)]"
	>
		<div class="flex flex-col h-[50vh] bg-transparent">
			<h2 id="toc-heading" class="text-lg font-bold mb-2 uppercase tracking-widest">
				{t("toc")}
			</h2>

			<ul class="max-h-[50vh] overflow-y-auto space-y-1 pr-4 no-scrollbar" style="scrollbar-width: none;">
				{#each filteredHeadings as heading}
					<li>
						<a
							href={`#${heading.slug}`}
							class:active={activeSlug === heading.slug}
							class="block whitespace-normal rounded-sm py-1 text-sm text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-accent)]"
							style:padding-left="{(heading.depth - minDepth) * 0.8}rem"
						>
							{heading.text}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>
{/if}

<style>
	/* 隐藏滚动条但保留功能  */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	:global(.active) { color: var(--color-accent) !important; font-weight: 650; }
</style>
