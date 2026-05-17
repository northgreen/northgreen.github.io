vim.api.nvim_create_autocmd("BufNewFile,BufRead", { pattern = "*.ejs", command = "set filetype=html" })
