vim.api.nvim_create_autocmd("BufRead", { pattern = "*.ejs", command = "set filetype=html" })
