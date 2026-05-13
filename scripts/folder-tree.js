'use strict';

// 递归构建文件夹树结构
// 从 post.source（如 "_posts/qwq/vev/test.md"）提取目录层次
// 返回树结构：{ name, path, children: [], posts: [], totalCount }

function buildFolderTree(posts) {
  var root = {
    name: '_root',
    path: '',
    children: [],
    posts: [],
    totalCount: 0
  };

  var dirMap = { '': root };  // path -> node mapping

  posts.forEach(function(post) {
    // 从 post.source 提取路径，如 "_posts/qwq/vev/test.md" -> "qwq/vev/test"
    var sourcePath = post.source || '';
    var relativePath = sourcePath.replace(/^_posts[\/\\]?/, '');
    var parts = relativePath.split(/[\/\\]/);
    var fileName = parts.pop().replace(/\.md$/, '');  // 去掉 .md 扩展名

    // 构建该文章所在目录的路径
    var dirPath = parts.join('/');

    // 确保目录路径中的每一级都存在
    if (dirPath) {
      var dirParts = parts;
      var currentPath = '';
      for (var i = 0; i < dirParts.length; i++) {
        var parentPath = currentPath;
        currentPath = currentPath ? currentPath + '/' + dirParts[i] : dirParts[i];

        if (!dirMap[currentPath]) {
          var newNode = {
            name: dirParts[i],
            path: currentPath,
            children: [],
            posts: [],
            totalCount: 0
          };
          dirMap[currentPath] = newNode;
          dirMap[parentPath].children.push(newNode);
        }
      }
    }

    // 添加文章到对应目录
    var postInfo = {
      title: post.title || fileName,
      path: post.path || '',
      date: post.date ? post.date.format('YYYY-MM-DD') : '',
      excerpt: post.excerpt || ''
    };
    dirMap[dirPath].posts.push(postInfo);
  });

  // 排序：目录按名称字母序，文章按日期倒序
  function sortNode(node) {
    node.children.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
    node.posts.sort(function(a, b) {
      return b.date.localeCompare(a.date);
    });

    // 递归排序子节点
    for (var i = 0; i < node.children.length; i++) {
      sortNode(node.children[i]);
    }

    // 计算 totalCount（自身文章数 + 所有子目录文章数）
    node.totalCount = node.posts.length;
    for (var j = 0; j < node.children.length; j++) {
      node.totalCount += node.children[j].totalCount;
    }
  }
  sortNode(root);

  return root;
}

hexo.extend.helper.register('build_folder_tree', function(posts) {
  return buildFolderTree(posts);
});
