import { pokerogueApi } from "#api/api";
import * as account from "#app/account";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import * as appConstants from "#constants/app-constants";
import { AbilityId } from "#enums/ability-id";
import { DexAttr } from "#enums/dex-attr";
import { MoveId } from "#enums/move-id";
import { SpeciesId } from "#enums/species-id";
import { GameManager } from "#test/framework/game-manager";
import type { SessionSaveData } from "#types/save-data";
import Phaser from "phaser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("System - Game Data", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override
      .moveset([MoveId.SPLASH])
      .battleStyle("single")
      .enemyAbility(AbilityId.BALL_FETCH)
      .enemyMoveset(MoveId.SPLASH);
  });

  describe("tryClearSession", () => {
    beforeEach(() => {
      vi.spyOn(appConstants, "bypassLogin", "get").mockReturnValue(false);
      vi.spyOn(game.scene.gameData, "getSessionSaveData").mockReturnValue({} as SessionSaveData);
      vi.spyOn(account, "updateUserInfo").mockImplementation(async () => [true, 1]);
    });

    it("should return [true, true] if bypassLogin is true", async () => {
      vi.spyOn(appConstants, "bypassLogin", "get").mockReturnValue(true);

      const result = await game.scene.gameData.tryClearSession(0);

      expect(result).toEqual([true, true]);
    });

    it("should return [true, true] if successful", async () => {
      vi.spyOn(pokerogueApi.savedata.session, "clear").mockResolvedValue({
        success: true,
      });

      const result = await game.scene.gameData.tryClearSession(0);

      expect(result).toEqual([true, true]);
      expect(account.updateUserInfo).toHaveBeenCalled();
    });

    it("should return [true, false] if not successful", async () => {
      vi.spyOn(pokerogueApi.savedata.session, "clear").mockResolvedValue({
        success: false,
      });

      const result = await game.scene.gameData.tryClearSession(0);

      expect(result).toEqual([true, false]);
      expect(account.updateUserInfo).toHaveBeenCalled();
    });

    it("should return [false, false] session is out of date", async () => {
      vi.spyOn(pokerogueApi.savedata.session, "clear").mockResolvedValue({
        error: "session out of date",
      });

      const result = await game.scene.gameData.tryClearSession(0);

      expect(result).toEqual([false, false]);
      expect(account.updateUserInfo).toHaveBeenCalled();
    });
  });

  describe("setPokemonCaught", () => {
    // Lycanroc forms: 0 = Midday, 1 = Midnight, 2 = Dusk; Rockruff forms: 0 = Normal, 1 = Own Tempo
    it.each([
      { name: "Midday", lycanrocForm: 0, rockruffForm: 0 },
      { name: "Midnight", lycanrocForm: 1, rockruffForm: 0 },
      { name: "Dusk", lycanrocForm: 2, rockruffForm: 1 },
    ])("$name Lycanroc should unlock the matching Rockruff form", async ({ lycanrocForm, rockruffForm }) => {
      await game.classicMode.startBattle(SpeciesId.FEEBAS);
      const { gameData } = game.scene;

      gameData.dexData[SpeciesId.ROCKRUFF].caughtAttr = 0n;
      gameData.dexData[SpeciesId.LYCANROC].caughtAttr = 0n;

      const lycanroc = game.scene.addPlayerPokemon(
        speciesDataRegistry.getSpecies(SpeciesId.LYCANROC),
        30,
        0,
        lycanrocForm,
      );
      await gameData.setPokemonCaught(lycanroc, true, false, false);

      const rockruffAttr = gameData.dexData[SpeciesId.ROCKRUFF].caughtAttr;
      expect(rockruffAttr & gameData.getFormAttr(rockruffForm)).toBeTruthy();
      expect(rockruffAttr & gameData.getFormAttr(1 - rockruffForm)).toBe(0n);
      expect(gameData.dexData[SpeciesId.LYCANROC].caughtAttr & gameData.getFormAttr(lycanrocForm)).toBeTruthy();
      expect(rockruffAttr & DexAttr.NON_SHINY || rockruffAttr & DexAttr.SHINY).toBeTruthy();
    });
  });
});
