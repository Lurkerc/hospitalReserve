let sql = require('../../../sql/admin');
let mySql = require('../../../models/mySql');

const {check, validationResult} = require('express-validator/check');
const {matchedData} = require('express-validator/filter');

let util = require('../../../util/index');
let keyMap = require('../../../util/keyMap');

const router = {
    // 获取登录用户的信息
    '/getUserInfo': [
        [
            check('userId').trim()
        ],
        (req, res) => {
            const resData = matchedData(req);
            let {userId = ''} = req.session.user;
            mySql.query(sql.queryUser,
                [['name', 'avator', 'userId', 'userName', 'access', 'lastTime', 'lastIp'], {userId: resData.userId || userId}],
                {type: keyMap.logType.userSelect, req, userId}
            ).then(rows => {
                if (rows.length) {
                    res.json({code: 0, msg: '帐号信息获取成功', data: rows[0]})
                } else {
                    res.json({code: 10, msg: '帐号不存在', data: {}})
                }
            });
        }
    ],
    // 密码验证
    '/checkPass': [
        [
            check('password').not().isEmpty().withMessage(keyMap.adminUser['password'] + keyMap.publicStr.notEmpty).trim(),
        ],
        (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.json({code: 1, msg: errors.mapped(), data: {}})
            }
            const resData = matchedData(req);
            let {userId = ''} = req.session.user;
            mySql.query(sql.queryUser,
                ['password', {userId}],
                {type: keyMap.logType.userCheckPassWord, req, userId}
            ).then(row => {
                if (row.length) {
                    if (row[0].password === util.eStr(resData.password)) {
                        res.json({code: 0, msg: '密码正确', data: {}})
                    } else {
                        res.json({code: 1, msg: '密码错误', data: {}})
                    }
                } else {
                    res.json({code: 10, msg: '帐号不存在', data: {}})
                }
            })
        }
    ],
    // 更新帐号信息
    '/updateUserInfo': [
        [
            check('name').not().isEmpty().withMessage(keyMap.adminUser['name'] + keyMap.publicStr.notEmpty).trim(),
            check('userName').not().isEmpty().withMessage(keyMap.adminUser['userName'] + keyMap.publicStr.notEmpty).trim(),
        ],
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({code: 1, msg: '', errors: errors.mapped()})
            }
            const resData = matchedData(req);
            let {userId = ''} = req.session.user;
            // 帐号已经存在
            mySql.query(sql.queryUser,
                [['userName', 'userId'], {userName: resData.userName}],
                {type: keyMap.logType.userSelect, req, userId}
            ).then(rows => {
                if (rows.length && rows[0].userId !== userId) {
                    res.json({code: 1, msg: '帐号已经存在，请重新输入新帐号', data: {}})
                } else {
                    // 不存在就更新
                    mySql.update(sql.updateUserById,
                        [{name: resData.name, userName: resData.userName}, userId],
                        {type: keyMap.logType.userUpdateInfo, req, userId}
                    ).then(rows => {
                        if (rows.affectedRows) {
                            res.json({code: 0, msg: '修改成功', data: {}});
                        } else {
                            res.json({code: 1, msg: '修改失败', data: {}});
                        }
                    })
                }
            })
        }
    ],
    // 修改密码
    '/updateUserPass': [
        [
            check('password').not().isEmpty().withMessage(keyMap.adminUser.password + keyMap.publicStr.notEmpty).trim(),
            check('newPassword').not().isEmpty().withMessage(keyMap.adminUser.newPassword + keyMap.publicStr.notEmpty).trim(),
        ],
        (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.json({code: 1, msg: errors.mapped(), data: {}})
            }
            const resData = matchedData(req);
            let {userId = ''} = req.session.user;
            mySql.query(sql.queryUser,
                ['password', {userId}],
                {type: keyMap.logType.userSelect, req, userId}
            ).then(row => {
                if (row.length) {
                    if (row[0].password === util.eStr(resData.password)) {
                        mySql.update(sql.updateUserById,
                            [{password: util.eStr(resData.newPassword)}, userId],
                            {type: keyMap.logType.userCheckPassWord, req, userId}
                        ).then(row => {
                            if (row.affectedRows) {
                                res.json({code: 0, msg: '密码修改成功', data: {}});
                            } else {
                                res.json({code: 1, msg: '密码修改失败', data: {}});
                            }
                        });
                    } else {
                        res.json({code: 1, msg: '原密码错误', data: {}})
                    }
                } else {
                    res.json({code: 10, msg: '帐号不存在', data: {}})
                }
            })
        }
    ],
    // 超级管理员更新帐号信息
    '/updateUserInfoByAdmin': [
        [
            check('userId').trim(),
            check('name').not().isEmpty().withMessage(keyMap.adminUser['name'] + keyMap.publicStr.notEmpty).trim(),
            check('userName').not().isEmpty().withMessage(keyMap.adminUser['userName'] + keyMap.publicStr.notEmpty).trim(),
            check('password').trim(),
        ],
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({code: 1, msg: '', errors: errors.mapped()})
            }
            const resData = matchedData(req);
            let {userId = '', access = ''} = req.session.user;
            if (!resData.userId) {
                return res.json({code: 1, msg: '参数错误', data: {}})
            }
            if (access || !userId) {
                return res.json({code: 1, msg: '暂无权限', data: {}})
            }
            let updateData = {name: resData.name, userName: resData.userName};
            if (resData.password) {
                updateData.password = util.eStr(resData.password)
            }
            // 更新
            mySql.update(sql.updateUserById,
                [updateData, resData.userId],
                {type: keyMap.logType.userUpdateInfo, req, userId}
            ).then(rows => {
                if (rows.affectedRows) {
                    res.json({code: 0, msg: '保存成功', data: {}});
                } else {
                    res.json({code: 1, msg: '保存失败', data: {}});
                }
            })
        }
    ],
    // 获取所有人员
    '/allUser': (req, res) => {
        let {userId = ''} = req.session.user;
        mySql.query(sql.queryAll,
            [['name', 'userId', 'userName', 'lastTime', 'lastIp'], 100, 0],
            {type: keyMap.logType.userSelect, req, userId}
        ).then(rows => {
            res.json({code: 0, msg: '', data: rows})
        });
    }
};

module.exports = router;
