---
title: 关于Linux下的剪切板
date: 2026-05-26 14:17:52
tags: Linux
---

Linux下的剪切板的方案的话话其实也就是两种：主选取（PRIMARY）和真正的剪切板（wl-clipboard）

## 剪切板

这个东西的话wayland下的话提供者还是桌面环境实现的协议以及wl-clipboard提供工具来操作，其实
很多时候用的剪切命令什么的（C-c；C-v） 这些都是它

这个cli东西其实同时提供了两个命令：`wl-copy`和`wl-paste`来在命令行实现剪切和粘贴（一个接受管道
输入到剪切板，另一个在调用的时候输出内容），其实这个东西没有什么特别好说的

``` sh

$wl-paste -h
Usage:
	wl-paste [options]
Paste content from the Wayland clipboard.

Options:
	-n, --no-newline	Do not append a newline character.
	-l, --list-types	Instead of pasting, list the offered types.
	-p, --primary		Use the "primary" clipboard.
	-w, --watch command	Run a command each time the selection changes.
	-t, --type mime/type	Override the inferred MIME type for the content.
	-s, --seat seat-name	Pick the seat to work with.
	-v, --version		Display version info.
	-h, --help		Display this message.
Mandatory arguments to long options are mandatory for short options too.

See wl-clipboard(1) for more details.
```

```sh
$wl-copy -h

Usage:
	wl-copy [options] text to copy
	wl-copy [options] < file-to-copy

Copy content to the Wayland clipboard.

Options:
	-o, --paste-once	Only serve one paste request and then exit.
	-f, --foreground	Stay in the foreground instead of forking.
	-c, --clear		Instead of copying, clear the clipboard.
	-p, --primary		Use the "primary" clipboard.
	-n, --trim-newline	Do not copy the trailing newline character.
	-t, --type mime/type	Override the inferred MIME type for the content.
	    --sensitive		Hint that the content is sensitive.
	-s, --seat seat-name	Pick the seat to work with.
	-v, --version		Display version info.
	-h, --help		Display this message.
Mandatory arguments to long options are mandatory for short options too.

See wl-clipboard(1) for more details.
```
更多的自己看manpage（

## PRIMARY缓冲区

这个东西的话比较冷门一些，大部分人从Windows转到Linux都不太会知道的东西（甚至我也是看了wiki
才知道的）当你选中文字的时候，就会将这一段内容自动地放入这个缓冲区里，并且当你按下中键的时候
就会将选中的东西粘贴进去，属于是和剪切板并行的另外一套机制，很久了，但是现在的桌面环境仍然保
留它

对于操作这东西的命令其实上面的有提到（没错，还是wl-copy/paste）

## 剪切板管理器

看完上面的到这里可能问题其实更多了，毕竟Winsows下可能是真实感觉到剪切板这么个东西，尤其是比较
新生代的可能入手win10以上都是有剪切板历史的显示的，这就会有一种『能看到剪切板』的错觉

但是实际上再往上的是没有这个东西的，很多时候是靠像是CopyQ来实现这个剪切板历史的

没错，这里提到的CopyQ，其实在Linux下也可以作为代替的剪切板历史的方案之一，除此之外还有很多其他
的提供者（甚至你自己使用rofi和一个常驻的脚本也能实现），这种把剪切板里的内容显示出来的才是剪切板
管理器，实际上无论是剪切板还是PRIMARY选区，这些机制其实还是桌面环境实现的（


嗯，感觉差不多说的很详细了（）也就到这里了

