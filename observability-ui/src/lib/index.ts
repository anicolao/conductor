import { mount, unmount } from "svelte";
import Magnifier from "./components/Magnifier.svelte";

export function enhanceImages(node: HTMLElement) {
	const images = node.querySelectorAll("img");
	const unmounts: (() => void)[] = [];

	images.forEach((img) => {
		const src = img.getAttribute("src");
		const alt = img.getAttribute("alt") || "";
		if (src) {
			const container = document.createElement("div");
			img.replaceWith(container);
			const component = mount(Magnifier, {
				target: container,
				props: { src, alt },
			});
			unmounts.push(() => unmount(component));
		}
	});

	return {
		destroy() {
			unmounts.forEach((u) => {
				u();
			});
		},
	};
}
