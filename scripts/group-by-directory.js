'use strict';

/**
 * group_by_directory helper
 * 
 * Groups posts by their first-level directory under _posts/.
 * Posts at _posts/ root are grouped under "未分类".
 * 
 * Usage in EJS:
 *   <% var groups = group_by_directory(page.posts); %>
 *   <% for (var dir in groups) { %>
 *     <h2><%= dir %></h2>
 *     <% groups[dir].forEach(function(post) { %>
 *       ...
 *     <% }) %>
 *   <% } %>
 */
hexo.extend.helper.register('group_by_directory', function(posts) {
  var groups = {};
  var POSTS_PREFIX = '_posts/';

  posts.each(function(post) {
    // post.source is like "_posts/qwq/test.md" or "_posts/hello-world.md"
    var source = post.source || '';
    var relativePath = source.startsWith(POSTS_PREFIX)
      ? source.substring(POSTS_PREFIX.length)
      : source;

    var parts = relativePath.split('/');
    var directory = parts.length > 1 ? parts[0] : '未分类';

    if (!groups[directory]) {
      groups[directory] = [];
    }
    groups[directory].push(post);
  });

  return groups;
});
