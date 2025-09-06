// routes/boards.spotlight.js
const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const {
  Board,
  Notification,
  Task,
  User,
  Column,
  Comment,
} = require("../Models/rootModel");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");

const boardRecentRouter = express.Router();

// demo auth; փոխիր քո իրականով
boardRecentRouter.use((req, _res, next) => {
  req.user = req.user;
  next();
});

/**
 * GET /boards/suggested?limit=3
 * Հաշվում է “խելացի առաջարկներ”՝ առանց նոր schema-ի.
 * Մետրիկաներ՝
 * - notifCount: վերջին 14 օրում board-ի մասին user-ի Notifications
 * - upcomingCount: user-ին վերագրված Tasks, որոնց timeEnd-ը հաջորդ 7 օրում է
 * - commentCount: user-ի Comments վերջին 14 օրում
 */
boardRecentRouter.get(
  "/api/boards/suggested",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const limit = Number(req.query.limit || 3);
      const now = new Date();
      const last14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 1) Notifications by board
      const notifRows = await Notification.findAll({
        where: {
          userId,
          boardId: { [Op.ne]: null },
          createdAt: { [Op.gte]: last14 },
        },
        attributes: [
          "boardId",
          [fn("COUNT", col("id")), "notifCount"],
          [fn("MAX", col("createdAt")), "lastNotif"],
        ],
        group: ["boardId"],
        raw: true,
      });

      // 2) Upcoming tasks for the user (next 7 days)
      const upcomingRows = await Task.findAll({
        where: { timeEnd: { [Op.gte]: now, [Op.lte]: next7 } },
        include: [
          {
            model: User,
            as: "assignedUsers",
            where: { id: userId },
            attributes: [],
            through: { attributes: [] },
          },
          {
            model: Column,
            attributes: [],
            include: [{ model: Board, attributes: [] }],
          },
        ],
        attributes: [
          [col("Column.Board.id"), "boardId"],
          [fn("COUNT", col("Task.id")), "upcomingCount"],
          [fn("MIN", col("Task.timeEnd")), "nextDue"],
        ],
        group: ["Column.Board.id"],
        raw: true,
      });

      // 3) User comments last 14 days (activity)
      const commentRows = await Comment.findAll({
        where: { userId, createdAt: { [Op.gte]: last14 } },
        include: [
          {
            model: Task,
            attributes: [],
            include: [
              {
                model: Column,
                attributes: [],
                include: [{ model: Board, attributes: [] }],
              },
            ],
          },
        ],
        attributes: [
          [col("Task.Column.Board.id"), "boardId"],
          [fn("COUNT", col("Comment.id")), "commentCount"],
          [fn("MAX", col("Comment.createdAt")), "lastComment"],
        ],
        group: ["Task.Column.Board.id"],
        raw: true,
      });

      // Merge + score
      const map = new Map();
      const upsert = (boardId, patch) => {
        const prev = map.get(boardId) || {
          boardId,
          notifCount: 0,
          upcomingCount: 0,
          commentCount: 0,
          lastActivity: null,
        };
        const next = { ...prev, ...patch };
        // lastActivity = max(lastNotif, lastComment, -nextDue as “sooner is more urgent” we’ll keep separately)
        const candidates = [
          prev.lastActivity,
          patch.lastNotif,
          patch.lastComment,
        ]
          .filter(Boolean)
          .map((d) => new Date(d));
        if (candidates.length)
          next.lastActivity = new Date(
            Math.max(...candidates.map((d) => d.getTime())),
          );
        map.set(boardId, next);
      };

      notifRows.forEach((r) =>
        upsert(r.boardId, {
          notifCount: Number(r.notifCount),
          lastNotif: r.lastNotif,
        }),
      );
      upcomingRows.forEach((r) =>
        upsert(r.boardId, {
          upcomingCount: Number(r.upcomingCount),
          nextDue: r.nextDue,
        }),
      );
      commentRows.forEach((r) =>
        upsert(r.boardId, {
          commentCount: Number(r.commentCount),
          lastComment: r.lastComment,
        }),
      );

      // scoring (կարգավորելի)
      const daysSince = (d) =>
        d ? (now - new Date(d)) / (1000 * 60 * 60 * 24) : 999;
      const scoreOf = (it) => {
        const recencyBoost = Math.max(0, 10 - daysSince(it.lastActivity)); // max≈10, հետո նվազում է
        const urgencyBoost = it.nextDue
          ? Math.max(0, 7 - daysSince(it.nextDue))
          : 0; // շուտ due => ավելի շատ
        return (
          it.notifCount * 2 +
          it.upcomingCount * 3 +
          it.commentCount * 1 +
          recencyBoost +
          urgencyBoost
        );
      };

      let metrics = Array.from(map.values());
      metrics.forEach((m) => (m.score = scoreOf(m)));
      metrics.sort((a, b) => b.score - a.score);
      metrics = metrics.slice(0, limit);

      if (!metrics.length) return res.json([]);

      const ids = metrics.map((m) => m.boardId);
      const boards = await Board.findAll({ where: { id: ids }, raw: true });
      const byId = new Map(boards.map((b) => [b.id, b]));
      const out = metrics
        .map((m) => {
          const b = byId.get(m.boardId);
          if (!b) return null;
          return {
            ...b,
            score: m.score,
            metrics: {
              notifCount: m.notifCount,
              upcomingCount: m.upcomingCount,
              commentCount: m.commentCount,
              lastActivity: m.lastActivity,
              nextDue: m.nextDue,
            },
          };
        })
        .filter(Boolean);

      res.json(out);
    } catch (err) {
      next(err);
    }
  },
);

/** Helpers for pinned (frontend localStorage-ն ID-ներ է պահում) */
// GET /boards/byIds?ids=1,2,3
boardRecentRouter.get(
  "/api/boards/byIds",
  authMiddleware,
  async (req, res, next) => {
    try {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter(Boolean);
      if (!ids.length) return res.json([]);
      const rows = await Board.findAll({ where: { id: ids }, raw: true });
      const map = new Map(rows.map((b) => [b.id, b]));
      res.json(ids.map((id) => map.get(id)).filter(Boolean));
    } catch (e) {
      next(e);
    }
  },
);

module.exports = boardRecentRouter;
