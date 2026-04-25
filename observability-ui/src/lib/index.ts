import { mount, unmount } from "svelte";
import Magnifier from "./components/Magnifier.svelte";

export function enhanceImages(node: HTMLElement, _content: string) {
	let unmounts: (() => void)[] = [];

	function enhance() {
		// Clean up existing if any (though Svelte @html might have already removed them from DOM)
		unmounts.forEach((u) => u());
		unmounts = [];

		const images = node.querySelectorAll("img");
		images.forEach((img) => {
			const src = img.getAttribute("src");
			const alt = img.getAttribute("alt") || "";
			if (src) {
				const container = document.createElement("div");
				// Use the same display as the original image to avoid layout shifts where possible
				container.style.display = "inline-block";
				container.style.maxWidth = "100%";
				img.replaceWith(container);
				const component = mount(Magnifier, {
					target: container,
					props: { src, alt },
				});
				unmounts.push(() => unmount(component));
			}
		});
	}

	enhance();

	return {
		update() {
			enhance();
		},
		destroy() {
			unmounts.forEach((u) => {
				u();
			});
		},
	};
}
