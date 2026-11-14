// Evita que se abra una consola junto a la ventana en Windows (solo en versión final).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    funcode_web_architect_lib::run()
}
