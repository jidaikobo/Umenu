
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

function db()
{
	var db = window.openDatabase("com.jidaikobo.umenu", "1.0", "test database", 1000000);

	if (!db)
	{
		return false;
	}

	return db;
}



app.controller('TopController', ['$scope', '$http', 'SharedData' , function($scope, $http, SharedData)
{

	console.debug('console debug');
	console.warn('console debug');
	/*
	 * get categories from db
	 */
	function categories()
	{
		$scope.categories = [];
		db().transaction(function(tx)
		{
			tx.executeSql('SELECT * FROM categories', [], function (tx, results)
			{
				for (var i = 0; i < results.rows.length; i++) {
					var row = results.rows.item(i);
					
					row.image = CATEGORY_ICONS[row.id];
					$scope.categories.push(row);
				}
				$scope.$apply();
			},
			function () {  });
		});
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
	 
	 
	/*
	 * sync server
	 */
	function sync ()
	{
		// $('#sync_spinner').show();

		$http({
			mothod: 'GET',
			url: 'http://www.umenu.jp/api.php'
		})
		.success(function (data, status, headers, config)
		{
			db().transaction(function(tx)
			{
				// favorite は上書きしない
				tx.executeSql('CREATE TABLE IF NOT EXISTS favorites (' +
					'item_id INTEGER' +
					')'
				);
				
				tx.executeSql('DROP TABLE IF EXISTS items');
				tx.executeSql('CREATE TABLE IF NOT EXISTS items (' +
					'id            INTEGER,' +
					'name          TEXT,'    +
					'created_time  DATETIME NOT NULL DEFAULT "2010-01-01 00:00:00",'    +
					'contents      TEXT,'    +
                    'pronounce     TEXT'     +
					')'
			    );
			
				tx.executeSql('DROP TABLE IF EXISTS categories');
				tx.executeSql('CREATE TABLE IF NOT EXISTS categories (' +
					'id           INTEGER,' +
					'name         TEXT'     +
					')'
				);

				tx.executeSql('DROP TABLE IF EXISTS categories_items');
				tx.executeSql('CREATE TABLE IF NOT EXISTS categories_items (' +
					'category_id    INTEGER,' +
					'item_id   INTEGER'  +
					')'
				);

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
                console.log('transaction failed');
				// $('#sync_spinner').hide();
			},
			function (res)
			{
                console.log('transaction success');
				categories();
				new_arrivals();
				favorites();
				// $('#sync_spinner').hide();
			});
		})
		.error(function (data, status, headers, config)
		{
			$('#sync_spinner').hide();
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

	ons.ready(function ()
	{
		$('#sync_spinner').hide();
		sync();
		// or
		categories();
		new_arrivals();
		favorites();
	});
	
}]);

app.controller('MenuController', ['$scope', function($scope)
{
	$scope.push = function()
	{
		console.log('pushed');
	};
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

var isJson = function(arg)
{
	arg = (typeof(arg) == "function") ? arg() : arg;
	if(typeof(arg) != "string"){return false;}
	try{arg = (!JSON) ? eval("(" + arg + ")") : JSON.parse(arg);return true;}catch(e){return false;}
}

