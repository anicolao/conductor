<script lang="ts">
import { onMount } from "svelte";

let { src, alt = "" } = $props();

let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let texture: WebGLTexture | null = null;

let mouseX = $state(0);
let mouseY = $state(0);
let isActive = $state(false);
let isPinned = $state(false);
let width = $state(0);
let height = $state(0);

const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_uv;
    void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_uv = a_texCoord;
    }
`;

const fsSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform sampler2D u_texture;
    uniform float u_zoom_factor;
    uniform float u_lens_radius;
    uniform bool u_active;
    varying vec2 v_uv;

    float circle(in float r, in vec2 pos, in vec2 pixel, float aspect) {
        vec2 d = pixel - pos;
        d.x *= aspect;
        float radius = length(d);
        float mask = smoothstep(r - 0.005, r + 0.005, radius);
        return (1.0 - mask);
    }

    float ring(in float r, in float width, in vec2 pos, in vec2 pixel, float aspect) {
        float outer_circle = circle(r + width / 2.0, pos, pixel, aspect);
        float inner_circle = circle(r - width / 2.0, pos, pixel, aspect);
        return outer_circle - inner_circle;
    }

    void main() {
        vec2 uv = v_uv;
        vec4 background = texture2D(u_texture, uv);
        
        if (!u_active) {
            gl_FragColor = background;
            return;
        }

        float aspect = u_resolution.x / u_resolution.y;
        vec2 zoom_pos = u_mouse / u_resolution;
        zoom_pos.y = 1.0 - zoom_pos.y; // Flip Y because mouse is top-down, WebGL is bottom-up
        
        float zoom_mask = circle(u_lens_radius, zoom_pos, uv, aspect);
        
        vec2 zoomed_p = (uv - zoom_pos) / u_zoom_factor + zoom_pos;
        vec4 zoomed_bg = texture2D(u_texture, zoomed_p);
        
        float ring_mask = ring(u_lens_radius, 0.02, zoom_pos, uv, aspect);
        vec4 ring_color = vec4(0.1, 0.2, 0.2, 1.0);
        
        gl_FragColor = (zoomed_bg * zoom_mask) + (background * (1.0 - zoom_mask)) + (ring_color * ring_mask);
    }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("Shader compile error:", gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function initWebGL() {
	if (!canvas) return;
	gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
	if (!gl) {
		console.error("WebGL not supported");
		return;
	}

	const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
	if (!vs || !fs) return;

	program = gl.createProgram();
	if (!program) return;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Program link error:", gl.getProgramInfoLog(program));
		return;
	}

	gl.useProgram(program);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	const positionLocation = gl.getAttribLocation(program, "a_position");
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	const texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
	const texCoords = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

	const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
	gl.enableVertexAttribArray(texCoordLocation);
	gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

	texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function updateTexture(img: HTMLImageElement) {
	if (!gl || !texture) return;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	render();
}

function render() {
	if (!gl || !program) return;

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	const uRes = gl.getUniformLocation(program, "u_resolution");
	const uMouse = gl.getUniformLocation(program, "u_mouse");
	const uZoom = gl.getUniformLocation(program, "u_zoom_factor");
	const uRadius = gl.getUniformLocation(program, "u_lens_radius");
	const uActive = gl.getUniformLocation(program, "u_active");

	gl.uniform2f(uRes, canvas.width, canvas.height);
	gl.uniform2f(uMouse, mouseX, mouseY);
	gl.uniform1f(uZoom, 3.0);
	gl.uniform1f(uRadius, 0.25);
	gl.uniform1i(uActive, isActive ? 1 : 0);

	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

onMount(() => {
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = src;
	img.onload = () => {
		width = img.width;
		height = img.height;
		canvas.width = img.width;
		canvas.height = img.height;
		initWebGL();
		updateTexture(img);
	};
});

$effect(() => {
	const hasInput = mouseX || mouseY;
	const hasState = isActive || isPinned;
	const needsRender = hasInput || hasState;
	if (needsRender && gl) {
		render();
	}
});

function handleMouseMove(e: MouseEvent) {
	if (isPinned) return;
	const rect = canvas.getBoundingClientRect();
	mouseX = e.clientX - rect.left;
	mouseY = e.clientY - rect.top;
	isActive = true;
}

function handleTouchMove(e: TouchEvent) {
	if (isPinned) return;
	const touch = e.touches[0];
	const rect = canvas.getBoundingClientRect();
	mouseX = touch.clientX - rect.left;
	mouseY = touch.clientY - rect.top;
	isActive = true;
	if (e.cancelable) e.preventDefault();
}

function togglePin(e: MouseEvent | TouchEvent) {
	const isTouch = e.type.startsWith("touch");
	const clientX =
		"clientX" in e
			? (e as MouseEvent).clientX
			: (e as TouchEvent).touches[0]?.clientX ||
				(e as TouchEvent).changedTouches[0]?.clientX;
	const clientY =
		"clientY" in e
			? (e as MouseEvent).clientY
			: (e as TouchEvent).touches[0]?.clientY ||
				(e as TouchEvent).changedTouches[0]?.clientY;

	if (clientX === undefined || clientY === undefined) return;

	const rect = canvas.getBoundingClientRect();
	const currentMouseX = clientX - rect.left;
	const currentMouseY = clientY - rect.top;

	if (isPinned) {
		isPinned = false;
		// On mobile, unpinning should also deactivate
		if (isTouch) {
			isActive = false;
		} else {
			mouseX = currentMouseX;
			mouseY = currentMouseY;
		}
	} else {
		isPinned = true;
		isActive = true;
		mouseX = currentMouseX;
		mouseY = currentMouseY;
	}

	// Prevent double triggers on touch
	if (isTouch && e.cancelable) {
		e.preventDefault();
	}
}
</script>

<div 
	class="magnifier-container"
	onmousemove={handleMouseMove}
	onmouseenter={() => !isPinned && (isActive = true)}
	onmouseleave={() => !isPinned && (isActive = false)}
	onclick={togglePin}
	ontouchmove={handleTouchMove}
	role="presentation"
>
	<canvas bind:this={canvas} {alt} style="max-width: 100%; height: auto;"></canvas>
	{#if isPinned}
		<div class="pin-indicator">PINNED</div>
	{/if}
</div>

<style>
	.magnifier-container {
		position: relative;
		display: inline-block;
		line-height: 0;
		max-width: 100%;
		border-radius: 4px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
	}
	canvas {
		display: block;
		cursor: crosshair;
	}
	.pin-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 10px;
		font-weight: bold;
		pointer-events: none;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
</style>
