const DB_VERSION = 1;
const STORE_DB_VERSION_KEY  = 'db_version';
const STORE_INITIALIZED_KEY = 'initialized';

const CATEGORY_ICONS = {
	1: 'menu_icon_fast_food.png',
	2: 'menu_icon_rice.png',
	3: 'menu_icon_noodle.png',
	4: 'menu_icon_cafe.png',
	5: 'menu_icon_bar.png',
};

var app = ons.bootstrap('myApp', [ 'ngSanitize' ]);

app.factory('SharedData', function()
{
	var sharedData = {};
	sharedData.data = {};
	
	// データを設定
	sharedData.set = function(data)
	{
		sharedData.data = data;
	};

	sharedData.get = function()
	{
		return sharedData.data;
	};

	return sharedData;
});

app.factory('Categories', function()
{
	var categories = {};
	categories.data = [];

	// db から categories すべてセット
	function reset ()
	{
		categories.data = [];
		db().transaction(function(tx)
		{
			tx.executeSql('SELECT * FROM categories', [], function (tx, results)
			{
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					
					row.image = CATEGORY_ICONS[row.id];
					categories.data.push(row);
				}
			},
			function () {  });
		});
		return categories.data;
	};

	categories.reset = function()
	{
		return reset();
	}

	categories.get = function()
	{
		return categories.data;
	}; 

	return categories;
});

const MIGRATIONS = [
	[ // 1
		'DROP TABLE IF EXISTS favorites',
		'CREATE TABLE IF NOT EXISTS favorites (' +
			'item_id INTEGER' +
			')',
		'DROP TABLE IF EXISTS items',
		'CREATE TABLE IF NOT EXISTS items (' +
			'id            INTEGER,' +
			'name          TEXT,'    +
			'created_time  DATETIME NOT NULL DEFAULT "2010-01-01 00:00:00",'    +
			'contents      TEXT,'    +
			'pronounce     TEXT'     +
			')',
		'DROP TABLE IF EXISTS categories',
		'CREATE TABLE IF NOT EXISTS categories (' +
			'id           INTEGER,' +
			'name         TEXT'     +
			')',
		'DROP TABLE IF EXISTS categories_items',
		'CREATE TABLE IF NOT EXISTS categories_items (' +
			'category_id    INTEGER,' +
			'item_id   INTEGER'  +
			')',
	],
];

function db()
{
	var db = window.openDatabase("com.jidaikobo.umenu", "1.0", "test database", 1000000);

	if (!db)
	{
		return false;
	}


	return db;
}

function migration(success_callback, failed_callback)
{
	// console.log('migration');
	var db_version  = localStorage.getItem(STORE_DB_VERSION_KEY);
	var initialized = localStorage.getItem(STORE_INITIALIZED_KEY);

	// console.log('migration');
	if (!db_version) db_version = 0;
	if (!initialized) initialized = 0;

	// console.log('db_version:' + db_version);
	// console.log('initialized:' + initialized);

	// create
	db().transaction(function(tx)
	{
		while (MIGRATIONS[db_version])
		{
			for (var i = 0; i < MIGRATIONS[db_version].length; i++)
			{
				sql = MIGRATIONS[db_version][i];
				tx.executeSql(sql);
			}
			db_version++;
		}
	},
	function (err)
	{
		console.log(err);
		console.log('migration transaction failed');
		// $('#sync_spinner').hide();
		//
		failed_callback();
	},
	function (res)
	{
		// db version を storage に
		// localStorage.setItem(STORE_DB_VERSION_KEY, db_version);

		console.log('migration transaction success');
		success_callback()
		// $('#sync_spinner').hide();
	});
}

function sync(success_callback, failed_callback, ajax_failed_callback, ajax_always_callback)
{
	$http({
		mothod: 'GET',
		url: 'http://www.umenu.jp/api.php'
	})
	.success(function (data, status, headers, config)
	{
		db().transaction(function(tx)
		{
			// favorite は上書きしない
			tx.executeSql('DELETE FROM items;');
			tx.executeSql('DELETE FROM categories;');
			tx.executeSql('DELETE FROM categories_items;');

			if (data.menus)
			{
				for (var key in data.menus)
				{
					var item = data.menus[key];
					params = [
							item.id,
							item.name,
							item.created_time,
							JSON.stringify(item.contents),
							item.pronounce,
					];
					tx.executeSql('INSERT INTO items (id, name, created_time, contents, pronounce) VALUES (?, ?, ?, ?, ?);', params, done, onerror);
				}
			}
			
			if (data.tags)
			{
				for (var key in data.tags)
				{
					var category = data.tags[key];
					params = [
							category.id,
							category.name,
					];
					tx.executeSql('INSERT INTO categories (id, name) VALUES (?, ?);', params, done, onerror);
				}
			}
			
			if (data.tags_items)
			{
				for (var key in data.tags_items)
				{
					var tag_item = data.tags_items[key];
					params = [
							tag_item.tag_id,
							tag_item.controller_id,
					];
					tx.executeSql('INSERT INTO categories_items (category_id, item_id) VALUES (?, ?);', params, done, onerror);
				}
			}
		},
		function (err)
		{
			console.log(err);
			console.log('sync transaction failed');
			failed_callback();
		},
		function (res)
		{
			console.log('sync transaction success');
			success_callback();
		});

		ajax_always_callback();
	})
	.error(function (data, status, headers, config)
	{
		console.log('sync ajax failed');
		ajax_failed_callback();
		ajax_always_callback();
	});
}

/*
 * td transaction executeSql callback for success
 */
function done(tx,results)
{
	// alert (results.rows.length);
}

/*
 * td transaction executeSql callback for error
 */
function onerror(error)
{
}


app.controller('TopController', ['$scope', '$http', 'SharedData', 'Categories' , function($scope, $http, SharedData, Categories)
{
	console.log('TopController');
	// アプリの初期化
	migration(
		function()
		{
			initialize();
			console.log('migrate success');
		},
		function()
		{
			console.log('migrate failed');
		}
	);
	// 最後に apply

	function initialize()
	{
		var need_sync = true;
		// init 済みでない もしくは 差分
		if (need_sync)
		{
			sync(
				// success
				function ()
				{
					console.log('sync success');
					$scope.categories = Categories.get();
					new_arrivals();
					$scope.$apply();
				},
				// failed
				function ()
				{
					console.log('sync failed');
				},
				// ajax_failed
				function ()
				{
					console.log('ajax failed');
				},
				// ajax_always
				function ()
				{
					console.log('sync always');
				}
			);
		}
		else
		{
			$scope.categories = Categories.get();
			new_arrivals();
			$scope.$apply();
		}
	}


	/*
	 * get new arrival items from db
	 */
	function new_arrivals()
	{
		$scope.new_arrivals = [];
		db().transaction(function(tx)
		{
			tx.executeSql('SELECT * FROM items ORDER BY created_time DESC LIMIT 10', [], function (tx, results)
			{
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					
					$scope.new_arrivals.push(row);
				}
				$scope.$apply();
			},
			function () {  });
		});
	}

	/*
	 * category ページへ
	 */
	$scope.pushCategoryPage = function (category)
	{
		SharedData.set(category);
		navi.pushPage('category.html');
	}
	/*
	 * メニュー個票へ
	 */
	$scope.pushItemPage = function (item)
	{
		SharedData.set(item);
		navi.pushPage('item.html');
	}

	ons.ready(function ()
	{
		// $('#sync_spinner').hide();
		// sync();
		// or
	});
}]);

app.controller('MenuController', ['$scope', 'SharedData', 'Categories', function($scope, SharedData, Categories)
{
	$scope.push = function()
	{
		console.log('pushed');
	};

	$scope.pushCategoryPage = function (category)
	{
		SharedData.set(category);
		navi.pushPage('category.html');
	}
	$scope.categories = Categories.get();
}]);

app.controller('CategoryController', ['$scope', 'SharedData', function($scope, SharedData)
{
	$scope.data = SharedData.get();
	$scope.items = [];

	db().transaction(function(tx)
	{
		if ($scope.data.id == "all") // すべて
		{
			tx.executeSql('SELECT * FROM items ORDER BY pronounce;', [], function (tx, results)
			{
				var ids = [];
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					$scope.items.push(row);
				}
				$scope.$apply();
			});
		}
		else
		{
			tx.executeSql('SELECT * FROM items, categories_items WHERE categories_items.item_id = items.id AND categories_items.category_id = ? ORDER BY pronounce;', [$scope.data.id], function (tx, results)
			{
				var ids = [];
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					$scope.items.push(row);
				}
				$scope.$apply();
			});
			
		}
	});
	
	$scope.showItemPage = function (data)
	{
		SharedData.set(data);
		navi.pushPage('item.html');
	}

}]);

/*
 * ItemController
 */
app.controller('ItemController', ['$scope', 'SharedData', '$rootScope', function($scope, SharedData, $rootScope)
{
	$scope.data      = SharedData.get();
	$scope.contents  = [];    // 本文
	$scope.favorited = false; // お気に入りに追加済みか

	db().transaction(function(tx)
	{  
		tx.executeSql('SELECT * FROM favorites WHERE item_id = ?;', [$scope.data.id], function (tx, results)
		{
			if (results.rows.length > 0)
			{
				$scope.favorited = true;
				$scope.$apply();
			}
		});
	});

	if (isJson($scope.data.contents))
	{
		$scope.contents = JSON.parse($scope.data.contents);
	}

	/*
	 * お気に入りに追加
	 */
	$scope.addFavorite = function()
	{
		db().transaction(function(tx)
		{        
		
			tx.executeSql('INSERT INTO favorites (item_id) VALUES (?);', [$scope.data.id], function (tx, results)
			{
				$scope.favorited = true;
				$scope.$apply();
				ons.notification.alert({
					title: 'お気に入りに追加',
					message: $scope.data.name + 'お気に入りに追加しました',
				});
			});
		});
	};

	/*
	 * お気に入りから削除
	 */
	$scope.removeFavorite = function()
	{
		db().transaction(function(tx)
		{        
		
			tx.executeSql('DELETE FROM favorites WHERE item_id = ?;', [$scope.data.id], function (tx, results)
			{
				$scope.favorited = false;
				$scope.$apply();
				ons.notification.alert({
					title: 'お気に入り削除',
					message: $scope.data.name + 'お気に入りから削除しました',
				});
			});
		});
	};

	/*
	 * お気に入りの追加削除をブロードキャスト
	 */
	navi.on("prepop", function(e)
	{
		// if (e.leavePage.name == "b.html")
		if (e.enterPage.name == 'top_component.html')
		{
			$rootScope.$broadcast('favoriteChanged', {});
		}
		navi.off('postpop');
	});
}]);



/*
 * FavoriteController
 */
app.controller('FavoriteController', ['$scope', 'SharedData', '$rootScope', function($scope, SharedData, $rootScope)
{
	/*
	 * get favorites from db
	 */
	function favorites()
	{
		db().transaction(function(tx)
		{
			$scope.favorites = [];
			tx.executeSql('SELECT * FROM items, favorites WHERE favorites.item_id = items.id;', [], function (tx, results)
			{
				var ids = [];
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					$scope.favorites.push(row);
				}
				$scope.$apply();
			});
		});
	}

	/*
	 * メニュー個票でお気に入り追加・削除が行われた物を反映する
	 */
	$scope.$on('favoriteChanged', function(e)
	{
		console.log('favoriteChanged');
		favorites();
	});
 
	favorites();
}]);


var isJson = function(arg)
{
	arg = (typeof(arg) == "function") ? arg() : arg;
	if(typeof(arg) != "string"){return false;}
	try{arg = (!JSON) ? eval("(" + arg + ")") : JSON.parse(arg);return true;}catch(e){return false;}
}

