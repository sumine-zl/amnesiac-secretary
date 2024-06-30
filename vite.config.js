import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from "vite-plugin-html"
import { viteSingleFile } from "vite-plugin-singlefile"
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/as/',
    build: {
        assetsDir: 'res',
        assetsInlineLimit: 0,
        outDir: 'dist',
        rollupOptions: {
            input: {
                index: 'index.html'
            },
        },
    },
    plugins: [
        vue(),
        viteSingleFile(),
        createHtmlPlugin({
            minify: true,
        }),
    ],
    publicDir: 'pub',
    resolve: {
        alias: {
            '@': fileURLToPath( new URL('./src', import.meta.url ))
        }
    }
})
